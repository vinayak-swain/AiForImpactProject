import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const StartSessionSchema = z.object({
  role: z.string(),
  interviewType: z.enum(['behavioural', 'technical', 'resume_based']),
  durationMins: z.number().int().positive(),
  resumeId: z.string().optional(),
});

const AnswerSchema = z.object({
  questionId: z.string(),
  answerText: z.string().min(10, 'Answer must be at least 10 characters long'),
});

const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  role: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().optional(),
});

export default async function sessionRoutes(fastify: FastifyInstance) {
  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /start
  fastify.post('/start', async (request, reply) => {
    const data = StartSessionSchema.parse(request.body);
    const userId = request.user.sub;

    // Fetch user and resume context
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
    });

    let resumeSummary = '';
    if (data.resumeId) {
      const resume = await fastify.prisma.resume.findUnique({
        where: { id: data.resumeId },
      });
      if (resume && resume.userId === userId) {
        resumeSummary = JSON.stringify(resume.parsedJson);
      }
    } else {
      // Use latest resume if available
      const latestResume = await fastify.prisma.resume.findFirst({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
      });
      if (latestResume) {
        resumeSummary = JSON.stringify(latestResume.parsedJson);
      }
    }

    // Call AI service to generate the first question
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    let questionText = 'Tell me about yourself and your background.';
    let questionType = data.interviewType;
    let difficulty = 'medium';
    let followUpHint = 'Ask them to elaborate on their technical achievements.';

    try {
      const response = await fetch(`${aiServiceUrl}/ai/generate-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: data.role,
          interview_type: data.interviewType,
          experience_level: user?.experienceLevel || 'junior',
          resume_summary: resumeSummary || null,
          previous_questions: [],
        }),
      });

      if (response.ok) {
        const questionData: any = await response.json();
        questionText = questionData.question_text || questionText;
        questionType = questionData.question_type || questionType;
        difficulty = questionData.difficulty || difficulty;
        followUpHint = questionData.follow_up_hint || followUpHint;
      }
    } catch (err) {
      fastify.log.error(err, 'Failed to fetch question from AI service. Using fallback.');
    }

    // Create session in DB
    const session = await fastify.prisma.session.create({
      data: {
        userId,
        interviewType: data.interviewType,
        role: data.role,
        durationMins: data.durationMins,
      },
    });

    // Create first question in DB
    const firstQuestion = await fastify.prisma.question.create({
      data: {
        sessionId: session.id,
        questionText,
        questionType,
        difficulty,
        orderIndex: 0,
      },
    });

    return {
      sessionId: session.id,
      firstQuestion,
    };
  });

  // POST /:id/answer
  fastify.post('/:id/answer', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const { questionId, answerText } = AnswerSchema.parse(request.body);
    const userId = request.user.sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { questions: { include: { answer: true } } },
    });

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    const question = session.questions.find((q) => q.id === questionId);
    if (!question) {
      return reply.status(404).send({ error: 'Not Found', message: 'Question not found' });
    }

    // Call AI Scorer
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    let scoreData: any = null;

    try {
      const response = await fetch(`${aiServiceUrl}/ai/score-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.questionText,
          answer: answerText,
          role: session.role,
          interview_type: session.interviewType,
        }),
      });

      if (response.ok) {
        scoreData = await response.json();
      } else {
        throw new Error(`AI Scorer returned ${response.status}`);
      }
    } catch (err) {
      fastify.log.error(err, 'AI Scorer offline. Using mock fallback score.');
      // Mock score data
      scoreData = {
        star_score: 18.0,
        tech_depth_score: 16.0,
        comm_score: 15.0,
        relevance_score: 12.0,
        confidence_score: 8.0,
        conciseness_score: 4.0,
        overall_score: 73.0,
        star_feedback: {
          situation: 'Explained the scenario clearly.',
          task: 'Defined the core problem statement.',
          action: 'Implemented the solution but could emphasize individual contributions more.',
          result: 'Achieved good metrics, but could quantify the outcomes.',
        },
        top_strength: 'Great communication and relevance to the problem.',
        top_weakness: 'Lacked depth in technical implementation details.',
        filler_words: ['like', 'actually'],
        ideal_answer_skeleton: 'Start with the scale of the system, mention the algorithm, detail personal action, and end with % improvement.',
      };
    }

    // Save answer and score to database
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;
    const answer = await fastify.prisma.answer.create({
      data: {
        questionId,
        userId,
        answerText,
        wordCount,
      },
    });

    const score = await fastify.prisma.score.create({
      data: {
        answerId: answer.id,
        starScore: scoreData.star_score,
        techDepthScore: scoreData.tech_depth_score,
        commScore: scoreData.comm_score,
        relevanceScore: scoreData.relevance_score,
        confidenceScore: scoreData.confidence_score,
        concisenessScore: scoreData.conciseness_score,
        overallScore: scoreData.overall_score,
        aiFeedbackJson: {
          star: scoreData.star_feedback,
          topStrength: scoreData.top_strength,
          topWeakness: scoreData.top_weakness,
          fillerWords: scoreData.filler_words,
          idealAnswerSkeleton: scoreData.ideal_answer_skeleton,
        },
      },
    });

    // Check if we need to generate next question (max 5 questions per session for standard practice)
    const currentQuestionCount = session.questions.length;
    let nextQuestion = null;

    if (currentQuestionCount < 5) {
      let nextQuestionText = 'Could you describe another project where you faced a similar challenge?';
      let nextQuestionType = session.interviewType;
      let nextDifficulty = 'medium';
      let nextFollowUpHint = 'Probe for concrete results.';

      try {
        const previousQuestionsText = session.questions.map((q) => q.questionText);
        const userDetails = await fastify.prisma.user.findUnique({ where: { id: userId } });
        
        // Grab latest resume for context
        const resume = await fastify.prisma.resume.findFirst({
          where: { userId },
          orderBy: { uploadedAt: 'desc' },
        });

        const response = await fetch(`${aiServiceUrl}/ai/generate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: session.role,
            interview_type: session.interviewType,
            experience_level: userDetails?.experienceLevel || 'junior',
            resume_summary: resume ? JSON.stringify(resume.parsedJson) : null,
            previous_questions: previousQuestionsText,
          }),
        });

        if (response.ok) {
          const qData: any = await response.json();
          nextQuestionText = qData.question_text || nextQuestionText;
          nextQuestionType = qData.question_type || nextQuestionType;
          nextDifficulty = qData.difficulty || nextDifficulty;
          nextFollowUpHint = qData.follow_up_hint || nextFollowUpHint;
        }
      } catch (err) {
        fastify.log.error(err, 'Failed to fetch next question. Using fallback.');
      }

      nextQuestion = await fastify.prisma.question.create({
        data: {
          sessionId: session.id,
          questionText: nextQuestionText,
          questionType: nextQuestionType,
          difficulty: nextDifficulty,
          orderIndex: currentQuestionCount,
        },
      });
    }

    return {
      scoreId: score.id,
      scores: score,
      nextQuestion,
    };
  });

  // GET /:id/feedback-stream (SSE)
  fastify.get('/:id/feedback-stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = request.user.sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { orderIndex: 'desc' },
          include: { answer: { include: { score: true } } },
        },
      },
    });

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    // Get the latest question that has an answer and score
    const latestQuestionWithScore = session.questions.find((q) => q.answer && q.answer.score);
    if (!latestQuestionWithScore || !latestQuestionWithScore.answer || !latestQuestionWithScore.answer.score) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No scored answers found to provide streaming feedback for' });
    }

    const answer = latestQuestionWithScore.answer;
    const score = latestQuestionWithScore.answer.score;

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const scoreJson = {
      star_score: score.starScore,
      tech_depth_score: score.techDepthScore,
      comm_score: score.commScore,
      relevance_score: score.relevanceScore,
      confidence_score: score.confidenceScore,
      conciseness_score: score.concisenessScore,
      overall_score: score.overallScore,
      star_feedback: (score.aiFeedbackJson as any).star,
      top_strength: (score.aiFeedbackJson as any).topStrength,
      top_weakness: (score.aiFeedbackJson as any).topWeakness,
      filler_words: (score.aiFeedbackJson as any).fillerWords,
      ideal_answer_skeleton: (score.aiFeedbackJson as any).idealAnswerSkeleton,
    };

    try {
      const response = await fetch(`${aiServiceUrl}/ai/generate-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_json: scoreJson,
          question: latestQuestionWithScore.questionText,
          role: session.role,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`AI Feedback Stream returned ${response.status}`);
      }

      // Read from the Response stream and pipe it to reply.raw
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply.raw.write(chunk);
      }
    } catch (err) {
      fastify.log.error(err, 'Error in streaming feedback from AI service');
      // Stream dummy coaching message
      reply.raw.write(`data: STRENGTH:\nGreat structure and assertive delivery.\n\n`);
      reply.raw.write(`data: WEAKNESS:\nCould expand on technical implementation steps.\n\n`);
      reply.raw.write(`data: NEXT_TIME:\nInclude metric percentages for concrete results.\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  // POST /:id/end
  fastify.post('/:id/end', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = request.user.sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { questions: { include: { answer: { include: { score: true } } } } },
    });

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    // Calculate overall session average score
    const scores = session.questions
      .map((q) => q.answer?.score?.overallScore)
      .filter((s): s is number => typeof s === 'number');

    const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

    // Assign letter grade
    let grade = 'F';
    if (avgScore >= 90) grade = 'A';
    else if (avgScore >= 80) grade = 'B';
    else if (avgScore >= 70) grade = 'C';
    else if (avgScore >= 50) grade = 'D';

    // Update Session
    const updatedSession = await fastify.prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        overallScore: avgScore,
        grade,
      },
    });

    // Check / update user badges
    const userSessions = await fastify.prisma.session.count({ where: { userId } });
    if (userSessions === 10) {
      await fastify.prisma.badge.create({ data: { userId, badgeType: 'sessions_10' } });
    }
    if (avgScore >= 80) {
      const scoreBadgeExists = await fastify.prisma.badge.findFirst({ where: { userId, badgeType: 'score_80' } });
      if (!scoreBadgeExists) {
        await fastify.prisma.badge.create({ data: { userId, badgeType: 'score_80' } });
      }
    }

    // Trigger async PDF report generation via Redis pub/sub
    try {
      const redisPayload = JSON.stringify({ session_id: sessionId, user_id: userId });
      await fastify.redis.publish('pdf:generate', redisPayload);
      fastify.log.info(`Published PDF trigger to channel 'pdf:generate' for session ${sessionId}`);
    } catch (err) {
      fastify.log.error(err, 'Failed to trigger PDF report job via Redis pub/sub');
    }

    return updatedSession;
  });

  // GET /:id
  fastify.get('/:id', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = request.user.sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: { answer: { include: { score: true } } },
        },
      },
    });

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    return session;
  });

  // GET /:id/report
  fastify.get('/:id/report', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = request.user.sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    // If report key isn't ready yet, fallback or wait
    const reportS3Key = session.reportS3Key || `reports/${userId}/${sessionId}.pdf`;

    try {
      const presignedUrl = await fastify.storage.getPresignedUrl(reportS3Key);
      return { url: presignedUrl };
    } catch (err) {
      fastify.log.error(err, 'Failed to generate presigned S3 url');
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to access report file' });
    }
  });

  // GET /history
  fastify.get('/history', async (request, reply) => {
    const userId = request.user.sub;
    const { page, limit, role, type, dateFrom } = HistoryQuerySchema.parse(request.query);

    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId,
      endedAt: { not: null },
    };

    if (role) {
      whereClause.role = { contains: role, mode: 'insensitive' };
    }

    if (type) {
      whereClause.interviewType = type;
    }

    if (dateFrom) {
      whereClause.startedAt = { gte: new Date(dateFrom) };
    }

    const sessions = await fastify.prisma.session.findMany({
      where: whereClause,
      include: {
        questions: {
          include: { answer: { include: { score: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await fastify.prisma.session.count({ where: whereClause });

    return {
      sessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  });
}
