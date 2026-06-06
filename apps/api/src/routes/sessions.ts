import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';

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
    const userId = (request.user as any).sub;

    // Fetch user details
    const userRes = await fastify.db.query('SELECT "experienceLevel" FROM "User" WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    // Fetch resume context
    let resumeSummary = '';
    if (data.resumeId) {
      const resumeRes = await fastify.db.query(
        'SELECT "parsedJson" FROM "Resume" WHERE id = $1 AND "userId" = $2',
        [data.resumeId, userId]
      );
      if (resumeRes.rowCount && resumeRes.rowCount > 0) {
        resumeSummary = JSON.stringify(resumeRes.rows[0].parsedJson);
      }
    } else {
      // Use latest resume if available
      const resumeRes = await fastify.db.query(
        'SELECT "parsedJson" FROM "Resume" WHERE "userId" = $1 ORDER BY "uploadedAt" DESC LIMIT 1',
        [userId]
      );
      if (resumeRes.rowCount && resumeRes.rowCount > 0) {
        resumeSummary = JSON.stringify(resumeRes.rows[0].parsedJson);
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
    const sessionId = crypto.randomUUID();
    const sessionRes = await fastify.db.query(
      'INSERT INTO "Session" (id, "userId", "interviewType", role, "durationMins") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [sessionId, userId, data.interviewType, data.role, data.durationMins]
    );

    // Create first question in DB
    const questionId = crypto.randomUUID();
    const questionRes = await fastify.db.query(
      'INSERT INTO "Question" (id, "sessionId", "questionText", "questionType", difficulty, "orderIndex") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [questionId, sessionId, questionText, questionType, difficulty, 0]
    );

    return {
      sessionId,
      firstQuestion: questionRes.rows[0],
    };
  });

  // POST /:id/answer
  fastify.post('/:id/answer', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const { questionId, answerText } = AnswerSchema.parse(request.body);
    const userId = (request.user as any).sub;

    const sessionRes = await fastify.db.query(
      'SELECT * FROM "Session" WHERE id = $1 AND "userId" = $2',
      [sessionId, userId]
    );

    if (sessionRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    // Fetch all questions for this session to verify and count
    const questionsRes = await fastify.db.query(
      'SELECT * FROM "Question" WHERE "sessionId" = $1 ORDER BY "orderIndex" ASC',
      [sessionId]
    );
    const questions = questionsRes.rows;

    const question = questions.find((q) => q.id === questionId);
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

    // Save answer to database
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;
    const answerId = crypto.randomUUID();
    const answerRes = await fastify.db.query(
      'INSERT INTO "Answer" (id, "questionId", "userId", "answerText", "wordCount") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [answerId, questionId, userId, answerText, wordCount]
    );

    // Save score to database
    const scoreId = crypto.randomUUID();
    const aiFeedbackJson = {
      star: scoreData.star_feedback,
      topStrength: scoreData.top_strength,
      topWeakness: scoreData.top_weakness,
      fillerWords: scoreData.filler_words,
      idealAnswerSkeleton: scoreData.ideal_answer_skeleton,
    };

    const scoreRes = await fastify.db.query(
      'INSERT INTO "Score" (id, "answerId", "starScore", "techDepthScore", "commScore", "relevanceScore", "confidenceScore", "concisenessScore", "overallScore", "aiFeedbackJson") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        scoreId,
        answerId,
        scoreData.star_score,
        scoreData.tech_depth_score,
        scoreData.comm_score,
        scoreData.relevance_score,
        scoreData.confidence_score,
        scoreData.conciseness_score,
        scoreData.overall_score,
        JSON.stringify(aiFeedbackJson),
      ]
    );

    // Check if we need to generate next question
    const currentQuestionCount = questions.length;
    let nextQuestion = null;

    if (currentQuestionCount < 5) {
      let nextQuestionText = 'Could you describe another project where you faced a similar challenge?';
      let nextQuestionType = session.interviewType;
      let nextDifficulty = 'medium';
      let nextFollowUpHint = 'Probe for concrete results.';

      try {
        const previousQuestionsText = questions.map((q) => q.questionText);
        
        // Grab latest resume for context
        const resumeRes = await fastify.db.query(
          'SELECT "parsedJson" FROM "Resume" WHERE "userId" = $1 ORDER BY "uploadedAt" DESC LIMIT 1',
          [userId]
        );
        const resumeSummary = resumeRes.rowCount ? JSON.stringify(resumeRes.rows[0].parsedJson) : null;

        // User experience level
        const userRes = await fastify.db.query('SELECT "experienceLevel" FROM "User" WHERE id = $1', [userId]);
        const expLevel = userRes.rows[0]?.experienceLevel || 'junior';

        // Fetch the conversation history so far (questions and answers)
        const historyRes = await fastify.db.query(
          `SELECT q."questionText", a."answerText" 
           FROM "Question" q 
           LEFT JOIN "Answer" a ON q.id = a."questionId" 
           WHERE q."sessionId" = $1 
           ORDER BY q."orderIndex" ASC`,
          [sessionId]
        );
        const chatHistory = historyRes.rows.map(row => ({
          question: row.questionText,
          answer: row.answerText || ''
        }));

        const response = await fetch(`${aiServiceUrl}/ai/generate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: session.role,
            interview_type: session.interviewType,
            experience_level: expLevel,
            resume_summary: resumeSummary,
            previous_questions: previousQuestionsText,
            chat_history: chatHistory,
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

      const nextQuestionId = crypto.randomUUID();
      const insertQRes = await fastify.db.query(
        'INSERT INTO "Question" (id, "sessionId", "questionText", "questionType", difficulty, "orderIndex") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [nextQuestionId, sessionId, nextQuestionText, nextQuestionType, nextDifficulty, currentQuestionCount]
      );
      nextQuestion = insertQRes.rows[0];
    }

    return {
      scoreId,
      scores: scoreRes.rows[0],
      nextQuestion,
    };
  });

  // GET /:id/feedback-stream (SSE)
  fastify.get('/:id/feedback-stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = (request.user as any).sub;

    const sessionRes = await fastify.db.query(
      'SELECT * FROM "Session" WHERE id = $1 AND "userId" = $2',
      [sessionId, userId]
    );

    if (sessionRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    // Fetch the latest question with an answer and a score
    const qWithScoreRes = await fastify.db.query(
      `SELECT q.*, a.id as "answerId", s.id as "scoreId", s."starScore", s."techDepthScore", s."commScore", 
              s."relevanceScore", s."confidenceScore", s."concisenessScore", s."overallScore", s."aiFeedbackJson" 
       FROM "Question" q 
       JOIN "Answer" a ON q.id = a."questionId" 
       JOIN "Score" s ON a.id = s."answerId" 
       WHERE q."sessionId" = $1 
       ORDER BY q."orderIndex" DESC LIMIT 1`,
      [sessionId]
    );

    if (qWithScoreRes.rowCount === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No scored answers found to provide streaming feedback for' });
    }

    const latestQ = qWithScoreRes.rows[0];

    // Set up SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const scoreJson = {
      star_score: latestQ.starScore,
      tech_depth_score: latestQ.techDepthScore,
      comm_score: latestQ.commScore,
      relevance_score: latestQ.relevanceScore,
      confidence_score: latestQ.confidenceScore,
      conciseness_score: latestQ.concisenessScore,
      overall_score: latestQ.overallScore,
      star_feedback: latestQ.aiFeedbackJson.star,
      top_strength: latestQ.aiFeedbackJson.topStrength,
      top_weakness: latestQ.aiFeedbackJson.topWeakness,
      filler_words: latestQ.aiFeedbackJson.fillerWords,
      ideal_answer_skeleton: latestQ.aiFeedbackJson.idealAnswerSkeleton,
    };

    try {
      const response = await fetch(`${aiServiceUrl}/ai/generate-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score_json: scoreJson,
          question: latestQ.questionText,
          role: session.role,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`AI Feedback Stream returned ${response.status}`);
      }

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
    const userId = (request.user as any).sub;

    const sessionRes = await fastify.db.query(
      'SELECT * FROM "Session" WHERE id = $1 AND "userId" = $2',
      [sessionId, userId]
    );

    if (sessionRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    // Get all scores for this session
    const scoresRes = await fastify.db.query(
      `SELECT s."overallScore" 
       FROM "Question" q 
       JOIN "Answer" a ON q.id = a."questionId" 
       JOIN "Score" s ON a.id = s."answerId" 
       WHERE q."sessionId" = $1`,
      [sessionId]
    );

    const scores = scoresRes.rows.map((r) => r.overallScore);
    const avgScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

    let grade = 'F';
    if (avgScore >= 90) grade = 'A';
    else if (avgScore >= 80) grade = 'B';
    else if (avgScore >= 70) grade = 'C';
    else if (avgScore >= 50) grade = 'D';

    // Update Session
    const updateRes = await fastify.db.query(
      'UPDATE "Session" SET "endedAt" = $1, "overallScore" = $2, grade = $3 WHERE id = $4 RETURNING *',
      [new Date(), avgScore, grade, sessionId]
    );

    // Check and update badges
    const userSessionsCountRes = await fastify.db.query(
      'SELECT COUNT(*) FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL',
      [userId]
    );
    const userSessionsCount = parseInt(userSessionsCountRes.rows[0].count, 10);

    if (userSessionsCount === 10) {
      // Check if they already have the badge
      const badgeRes = await fastify.db.query(
        'SELECT 1 FROM "Badge" WHERE "userId" = $1 AND "badgeType" = \'sessions_10\'',
        [userId]
      );
      if (badgeRes.rowCount === 0) {
        const badgeId = crypto.randomUUID();
        await fastify.db.query(
          'INSERT INTO "Badge" (id, "userId", "badgeType") VALUES ($1, $2, $3)',
          [badgeId, userId, 'sessions_10']
        );
      }
    }

    if (avgScore >= 80) {
      const badgeRes = await fastify.db.query(
        'SELECT 1 FROM "Badge" WHERE "userId" = $1 AND "badgeType" = \'score_80\'',
        [userId]
      );
      if (badgeRes.rowCount === 0) {
        const badgeId = crypto.randomUUID();
        await fastify.db.query(
          'INSERT INTO "Badge" (id, "userId", "badgeType") VALUES ($1, $2, $3)',
          [badgeId, userId, 'score_80']
        );
      }
    }

    // Trigger PDF report generation via Redis
    try {
      const redisPayload = JSON.stringify({ session_id: sessionId, user_id: userId });
      await fastify.redis.publish('pdf:generate', redisPayload);
      fastify.log.info(`Published PDF trigger to channel 'pdf:generate' for session ${sessionId}`);
    } catch (err) {
      fastify.log.error(err, 'Failed to trigger PDF report job via Redis pub/sub');
    }

    // Generate a mock PDF if running in local/mock database mode
    const isMockDb = fastify.db.constructor.name === 'MockPool';
    if (isMockDb) {
      try {
        const reportS3Key = `reports/${userId}/${sessionId}.pdf`;
        const mockPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> >>
endobj
4 0 obj
<< /Length 150 >>
stream
BT
/F1 24 Tf
100 700 Td
(TechPrep AI Interview Report) Tj
/F1 12 Tf
0 -40 Td
(Role Target: ${updateRes.rows[0].role}) Tj
0 -20 Td
(Overall Score: ${Math.round(avgScore)}%) Tj
0 -20 Td
(Grade: ${grade}) Tj
0 -40 Td
(Detailed feedback and visual radar charts will be shown) Tj
0 -20 Td
(in the interactive dashboard logs under your session.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000248 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
450
%%EOF`;
        await fastify.storage.uploadFile(reportS3Key, Buffer.from(mockPdfContent), 'application/pdf');
        
        // Update mock db session reportS3Key
        await fastify.db.query(
          'UPDATE "Session" SET "reportS3Key" = $1 WHERE id = $2 RETURNING *',
          [reportS3Key, sessionId]
        );
      } catch (err) {
        fastify.log.error(err, 'Failed to generate mock PDF report');
      }
    }

    return updateRes.rows[0];
  });

  // GET /:id
  fastify.get('/:id', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = (request.user as any).sub;

    const sessionRes = await fastify.db.query(
      'SELECT * FROM "Session" WHERE id = $1 AND "userId" = $2',
      [sessionId, userId]
    );

    if (sessionRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    // Fetch questions, answers, and scores
    const questionsRes = await fastify.db.query(
      `SELECT q.*, a.id as "answerId", a."userId" as "answerUserId", a."answerText", a."wordCount", a."submittedAt",
              s.id as "scoreId", s."starScore", s."techDepthScore", s."commScore", 
              s."relevanceScore", s."confidenceScore", s."concisenessScore", s."overallScore", s."aiFeedbackJson"
       FROM "Question" q
       LEFT JOIN "Answer" a ON q.id = a."questionId"
       LEFT JOIN "Score" s ON a.id = s."answerId"
       WHERE q."sessionId" = $1
       ORDER BY q."orderIndex" ASC`,
      [sessionId]
    );

    const questions = questionsRes.rows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      questionText: row.questionText,
      questionType: row.questionType,
      difficulty: row.difficulty,
      orderIndex: row.orderIndex,
      answer: row.answerId ? {
        id: row.answerId,
        questionId: row.id,
        userId: row.answerUserId,
        answerText: row.answerText,
        wordCount: row.wordCount,
        submittedAt: row.submittedAt,
        score: row.scoreId ? {
          id: row.scoreId,
          answerId: row.answerId,
          starScore: row.starScore,
          techDepthScore: row.techDepthScore,
          commScore: row.commScore,
          relevanceScore: row.relevanceScore,
          confidenceScore: row.confidenceScore,
          concisenessScore: row.concisenessScore,
          overallScore: row.overallScore,
          aiFeedbackJson: row.aiFeedbackJson,
        } : null,
      } : null,
    }));

    session.questions = questions;
    return session;
  });

  // GET /:id/report
  fastify.get('/:id/report', async (request, reply) => {
    const { id: sessionId } = request.params as { id: string };
    const userId = (request.user as any).sub;

    const sessionRes = await fastify.db.query(
      'SELECT "reportS3Key" FROM "Session" WHERE id = $1 AND "userId" = $2',
      [sessionId, userId]
    );

    if (sessionRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }

    const session = sessionRes.rows[0];
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
    const userId = (request.user as any).sub;
    const { page, limit, role, type, dateFrom } = HistoryQuerySchema.parse(request.query);

    const offset = (page - 1) * limit;

    let queryStr = 'SELECT * FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL';
    let countStr = 'SELECT COUNT(*) FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (role) {
      queryStr += ` AND role ILIKE $${paramIndex}`;
      countStr += ` AND role ILIKE $${paramIndex}`;
      params.push(`%${role}%`);
      paramIndex++;
    }

    if (type) {
      queryStr += ` AND "interviewType" = $${paramIndex}`;
      countStr += ` AND "interviewType" = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (dateFrom) {
      queryStr += ` AND "startedAt" >= $${paramIndex}`;
      countStr += ` AND "startedAt" >= $${paramIndex}`;
      params.push(new Date(dateFrom));
      paramIndex++;
    }

    queryStr += ` ORDER BY "startedAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const queryParams = [...params, limit, offset];

    const sessionsRes = await fastify.db.query(queryStr, queryParams);
    const countRes = await fastify.db.query(countStr, params);
    const total = parseInt(countRes.rows[0].count, 10);

    const sessions = sessionsRes.rows;

    // Fetch questions and answers for each session
    for (const session of sessions) {
      const questionsRes = await fastify.db.query(
        `SELECT q.*, a.id as "answerId", a."userId" as "answerUserId", a."answerText", a."wordCount", a."submittedAt",
                s.id as "scoreId", s."starScore", s."techDepthScore", s."commScore", 
                s."relevanceScore", s."confidenceScore", s."concisenessScore", s."overallScore", s."aiFeedbackJson"
         FROM "Question" q
         LEFT JOIN "Answer" a ON q.id = a."questionId"
         LEFT JOIN "Score" s ON a.id = s."answerId"
         WHERE q."sessionId" = $1
         ORDER BY q."orderIndex" ASC`,
        [session.id]
      );

      session.questions = questionsRes.rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        questionText: row.questionText,
        questionType: row.questionType,
        difficulty: row.difficulty,
        orderIndex: row.orderIndex,
        answer: row.answerId ? {
          id: row.answerId,
          questionId: row.id,
          userId: row.answerUserId,
          answerText: row.answerText,
          wordCount: row.wordCount,
          submittedAt: row.submittedAt,
          score: row.scoreId ? {
            id: row.scoreId,
            answerId: row.answerId,
            starScore: row.starScore,
            techDepthScore: row.techDepthScore,
            commScore: row.commScore,
            relevanceScore: row.relevanceScore,
            confidenceScore: row.confidenceScore,
            concisenessScore: row.concisenessScore,
            overallScore: row.overallScore,
            aiFeedbackJson: row.aiFeedbackJson,
          } : null,
        } : null,
      }));
    }

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
