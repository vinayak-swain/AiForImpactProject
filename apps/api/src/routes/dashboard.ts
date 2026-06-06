import { FastifyInstance } from 'fastify';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Protect all dashboard routes
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /stats
  fastify.get('/stats', async (request, reply) => {
    const userId = (request.user as any).sub;

    const userRes = await fastify.db.query(
      'SELECT * FROM "User" WHERE id = $1',
      [userId]
    );
    const user = userRes.rows[0];

    const sessionsRes = await fastify.db.query(
      'SELECT * FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL ORDER BY "endedAt" DESC',
      [userId]
    );
    const sessions = sessionsRes.rows;
    const totalSessions = sessions.length;

    const overallScores = sessions
      .map((s: any) => s.overallScore)
      .filter((s: any): s is number => s !== null);

    const avgScore = overallScores.length > 0 ? overallScores.reduce((a: number, b: number) => a + b, 0) / overallScores.length : 0;
    const bestScore = overallScores.length > 0 ? Math.max(...overallScores) : 0;

    // Questions answered
    const countRes = await fastify.db.query(
      'SELECT COUNT(*)::int FROM "Answer" WHERE "userId" = $1',
      [userId]
    );
    const questionsAnswered = countRes.rows[0].count;

    // Calculate dimensions average
    const scoresRes = await fastify.db.query(
      `SELECT s.* 
       FROM "Score" s 
       JOIN "Answer" a ON s."answerId" = a.id 
       JOIN "Question" q ON a."questionId" = q.id 
       JOIN "Session" se ON q."sessionId" = se.id 
       WHERE se."userId" = $1 AND se."endedAt" IS NOT NULL`,
      [userId]
    );
    const scores = scoresRes.rows;

    let totalStar = 0, totalTech = 0, totalComm = 0, totalRel = 0, totalConf = 0, totalConc = 0;
    const scoreCount = scores.length;

    scores.forEach((s: any) => {
      totalStar += s.starScore;
      totalTech += s.techDepthScore;
      totalComm += s.commScore;
      totalRel += s.relevanceScore;
      totalConf += s.confidenceScore;
      totalConc += s.concisenessScore;
    });

    const dimensionAverages = {
      star: scoreCount > 0 ? totalStar / scoreCount : 0,
      techDepth: scoreCount > 0 ? totalTech / scoreCount : 0,
      comm: scoreCount > 0 ? totalComm / scoreCount : 0,
      relevance: scoreCount > 0 ? totalRel / scoreCount : 0,
      confidence: scoreCount > 0 ? totalConf / scoreCount : 0,
      conciseness: scoreCount > 0 ? totalConc / scoreCount : 0,
    };

    // Calculate weak areas
    const maxScores = {
      star: 25,
      techDepth: 25,
      comm: 20,
      relevance: 15,
      confidence: 10,
      conciseness: 5,
    };

    const weakAreas = [];
    if (scoreCount > 0) {
      if (dimensionAverages.star / maxScores.star < 0.75) {
        weakAreas.push({
          dimension: 'STAR Structure',
          avgPercentage: Math.round((dimensionAverages.star / maxScores.star) * 100),
          suggestion: 'Improve Situation-Task clarity. Use the Action phase to highlight personal ownership and quantify results.',
        });
      }
      if (dimensionAverages.techDepth / maxScores.techDepth < 0.75) {
        weakAreas.push({
          dimension: 'Technical Depth',
          avgPercentage: Math.round((dimensionAverages.techDepth / maxScores.techDepth) * 100),
          suggestion: 'Mention specific API protocols, architecture configurations, design patterns, or algorithms in answers.',
        });
      }
      if (dimensionAverages.comm / maxScores.comm < 0.75) {
        weakAreas.push({
          dimension: 'Communication',
          avgPercentage: Math.round((dimensionAverages.comm / maxScores.comm) * 100),
          suggestion: 'Reduce filler words such as "like", "actually", "basically". Practice pacing and structuring transitions.',
        });
      }
      if (dimensionAverages.relevance / maxScores.relevance < 0.75) {
        weakAreas.push({
          dimension: 'Relevance',
          avgPercentage: Math.round((dimensionAverages.relevance / maxScores.relevance) * 100),
          suggestion: 'Address the prompt directly at the beginning. Ensure the conclusion ties back to the core question.',
        });
      }
      if (dimensionAverages.confidence / maxScores.confidence < 0.75) {
        weakAreas.push({
          dimension: 'Confidence',
          avgPercentage: Math.round((dimensionAverages.confidence / maxScores.confidence) * 100),
          suggestion: 'Avoid defensive hedging terms ("I think", "maybe"). Speak assertively about your individual contributions.',
        });
      }
      if (dimensionAverages.conciseness / maxScores.conciseness < 0.75) {
        weakAreas.push({
          dimension: 'Conciseness',
          avgPercentage: Math.round((dimensionAverages.conciseness / maxScores.conciseness) * 100),
          suggestion: 'Aim for the optimal length of 100-400 words per response to cover details without rambling.',
        });
      }
    }

    if (weakAreas.length === 0) {
      weakAreas.push({
        dimension: 'STAR Structure',
        avgPercentage: 0,
        suggestion: 'Ensure your behavioral answers clearly cover Situation, Task, Action, and Result.',
      });
      weakAreas.push({
        dimension: 'Technical Depth',
        avgPercentage: 0,
        suggestion: 'Explain structural backend architectural designs and algorithmic complexity trade-offs.',
      });
    }

    // Recent sessions (last 5)
    const recentSessions = sessions.slice(0, 5).map((s: any) => ({
      id: s.id,
      role: s.role,
      interviewType: s.interviewType,
      overallScore: s.overallScore,
      grade: s.grade,
      endedAt: s.endedAt,
    }));

    return {
      totalSessions,
      avgScore: Math.round(avgScore * 10) / 10,
      bestScore: Math.round(bestScore * 10) / 10,
      streak: user?.streak || 0,
      questionsAnswered,
      weakAreas: weakAreas.slice(0, 3),
      recentSessions,
      dimensionAverages,
    };
  });

  // GET /score-trend
  fastify.get('/score-trend', async (request, reply) => {
    const userId = (request.user as any).sub;
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '10', 10);

    const trendRes = await fastify.db.query(
      'SELECT id, "overallScore", "endedAt", role FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL ORDER BY "endedAt" ASC LIMIT $2',
      [userId, limit]
    );

    return trendRes.rows.map((s: any) => ({
      id: s.id,
      score: s.overallScore,
      date: s.endedAt ? new Date(s.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      role: s.role,
    }));
  });

  // GET /radar-data
  fastify.get('/radar-data', async (request, reply) => {
    const userId = (request.user as any).sub;

    // Fetch all scores for average
    const allScoresRes = await fastify.db.query(
      `SELECT s.* 
       FROM "Score" s 
       JOIN "Answer" a ON s."answerId" = a.id 
       JOIN "Question" q ON a."questionId" = q.id 
       JOIN "Session" se ON q."sessionId" = se.id 
       WHERE se."userId" = $1 AND se."endedAt" IS NOT NULL`,
      [userId]
    );
    const scores = allScoresRes.rows;

    let totalStar = 0, totalTech = 0, totalComm = 0, totalRel = 0, totalConf = 0, totalConc = 0;
    const scoreCount = scores.length;

    scores.forEach((s: any) => {
      totalStar += (s.starScore / 25) * 100;
      totalTech += (s.techDepthScore / 25) * 100;
      totalComm += (s.commScore / 20) * 100;
      totalRel += (s.relevanceScore / 15) * 100;
      totalConf += (s.confidenceScore / 10) * 100;
      totalConc += (s.concisenessScore / 5) * 100;
    });

    // Fetch scores for latest session
    const currentScoresRes = await fastify.db.query(
      `SELECT s.* 
       FROM "Score" s 
       JOIN "Answer" a ON s."answerId" = a.id 
       JOIN "Question" q ON a."questionId" = q.id 
       WHERE q."sessionId" = (SELECT id FROM "Session" WHERE "userId" = $1 AND "endedAt" IS NOT NULL ORDER BY "endedAt" DESC LIMIT 1)`,
      [userId]
    );
    const currentScores = currentScoresRes.rows;

    let currentStar = 0, currentTech = 0, currentComm = 0, currentRel = 0, currentConf = 0, currentConc = 0;
    const currentScoreCount = currentScores.length;

    currentScores.forEach((s: any) => {
      currentStar += (s.starScore / 25) * 100;
      currentTech += (s.techDepthScore / 25) * 100;
      currentComm += (s.commScore / 20) * 100;
      currentRel += (s.relevanceScore / 15) * 100;
      currentConf += (s.confidenceScore / 10) * 100;
      currentConc += (s.concisenessScore / 5) * 100;
    });

    const avgRadar = [
      { subject: 'STAR Structure', current: currentScoreCount > 0 ? Math.round(currentStar / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalStar / scoreCount) : 0 },
      { subject: 'Technical Depth', current: currentScoreCount > 0 ? Math.round(currentTech / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalTech / scoreCount) : 0 },
      { subject: 'Communication', current: currentScoreCount > 0 ? Math.round(currentComm / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalComm / scoreCount) : 0 },
      { subject: 'Relevance', current: currentScoreCount > 0 ? Math.round(currentRel / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalRel / scoreCount) : 0 },
      { subject: 'Confidence', current: currentScoreCount > 0 ? Math.round(currentConf / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalConf / scoreCount) : 0 },
      { subject: 'Conciseness', current: currentScoreCount > 0 ? Math.round(currentConc / currentScoreCount) : 0, average: scoreCount > 0 ? Math.round(totalConc / scoreCount) : 0 },
    ];

    return avgRadar;
  });
}
