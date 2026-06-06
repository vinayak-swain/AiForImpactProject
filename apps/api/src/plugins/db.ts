import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool | MockPool;
  }
}

// Simple in-memory database to store state when running in mock fallback mode
const inMemoryDb: { [key: string]: any[] } = {
  User: [
    {
      id: 'mock-user-id-1234',
      email: 'mock-test-candidate@example.com',
      name: 'Test Candidate',
      roleTarget: 'Fullstack Engineer',
      experienceLevel: 'mid',
      streak: 1,
      isPro: false,
      lastActiveDate: new Date(),
      createdAt: new Date(),
    }
  ],
  Resume: [],
  Session: [],
  Question: [],
  Answer: [],
  Score: [],
  Badge: [],
};

class MockPool {
  async connect() {
    return { release: () => {} };
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    // --- USER QUERIES ---
    if (normalized.includes('SELECT id FROM "User" WHERE email =')) {
      const email = params[0];
      const matches = inMemoryDb.User.filter((u) => u.email === email).map((u) => ({ id: u.id }));
      return { rows: matches, rowCount: matches.length };
    }

    if (normalized.includes('SELECT * FROM "User" WHERE email =')) {
      const email = params[0];
      const matches = inMemoryDb.User.filter((u) => u.email === email);
      return { rows: matches, rowCount: matches.length };
    }

    if (normalized.includes('SELECT "experienceLevel" FROM "User" WHERE id =')) {
      const id = params[0];
      const user = inMemoryDb.User.find((u) => u.id === id);
      return { rows: user ? [{ experienceLevel: user.experienceLevel }] : [], rowCount: user ? 1 : 0 };
    }

    if (normalized.includes('SELECT * FROM "User" WHERE id =')) {
      const id = params[0];
      const matches = inMemoryDb.User.filter((u) => u.id === id);
      return { rows: matches, rowCount: matches.length };
    }

    if (normalized.startsWith('INSERT INTO "User"')) {
      let user: any = {};
      if (normalized.includes('"passwordHash"')) {
        user = {
          id: params[0],
          name: params[1],
          email: params[2],
          passwordHash: params[3],
          roleTarget: params[4],
          experienceLevel: params[5],
          provider: params[6] || 'email',
          streak: params[7] || 0,
          isPro: false,
          lastActiveDate: null,
          createdAt: new Date(),
        };
      } else {
        user = {
          id: params[0],
          email: params[1],
          name: params[2],
          avatarUrl: params[3],
          provider: params[4],
          roleTarget: params[5],
          experienceLevel: params[6],
          streak: 0,
          isPro: false,
          lastActiveDate: null,
          createdAt: new Date(),
        };
      }
      inMemoryDb.User.push(user);
      return { rows: [user], rowCount: 1 };
    }

    if (normalized.startsWith('UPDATE "User"')) {
      const lastActive = params[0];
      const streak = params[1];
      const id = params[2];
      const user = inMemoryDb.User.find((u) => u.id === id);
      if (user) {
        user.lastActiveDate = lastActive;
        user.streak = streak;
      }
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    // --- RESUME QUERIES ---
    if (normalized.includes('SELECT "parsedJson" FROM "Resume" WHERE id =') && normalized.includes('"userId" =')) {
      const id = params[0];
      const userId = params[1];
      const matches = inMemoryDb.Resume.filter((r) => r.id === id && r.userId === userId);
      return { rows: matches, rowCount: matches.length };
    }

    if (normalized.includes('SELECT "parsedJson" FROM "Resume" WHERE "userId" =') && normalized.includes('ORDER BY "uploadedAt" DESC LIMIT 1')) {
      const userId = params[0];
      const sorted = inMemoryDb.Resume.filter((r) => r.userId === userId).sort(
        (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
      );
      return { rows: sorted.slice(0, 1), rowCount: Math.min(sorted.length, 1) };
    }

    if (normalized.includes('SELECT * FROM "Resume" WHERE "userId" =') && normalized.includes('ORDER BY "uploadedAt" DESC')) {
      const userId = params[0];
      const sorted = inMemoryDb.Resume.filter((r) => r.userId === userId).sort(
        (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
      );
      return { rows: sorted, rowCount: sorted.length };
    }

    if (normalized.startsWith('INSERT INTO "Resume"')) {
      const resume = {
        id: params[0],
        userId: params[1],
        s3Key: params[2],
        parsedJson: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        uploadedAt: new Date(),
      };
      inMemoryDb.Resume.push(resume);
      return { rows: [resume], rowCount: 1 };
    }

    // --- SESSION QUERIES ---
    if (normalized.startsWith('INSERT INTO "Session"')) {
      const session = {
        id: params[0],
        userId: params[1],
        interviewType: params[2],
        role: params[3],
        durationMins: params[4],
        overallScore: null,
        grade: null,
        reportS3Key: null,
        startedAt: new Date(),
        endedAt: null,
      };
      inMemoryDb.Session.push(session);
      return { rows: [session], rowCount: 1 };
    }

    if (normalized.includes('SELECT * FROM "Session" WHERE id =') && normalized.includes('"userId" =')) {
      const id = params[0];
      const userId = params[1];
      const session = inMemoryDb.Session.find((s) => s.id === id && s.userId === userId);
      return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
    }

    if (normalized.includes('SELECT "reportS3Key" FROM "Session" WHERE id =') && normalized.includes('"userId" =')) {
      const id = params[0];
      const userId = params[1];
      const session = inMemoryDb.Session.find((s) => s.id === id && s.userId === userId);
      return { rows: session ? [{ reportS3Key: session.reportS3Key }] : [], rowCount: session ? 1 : 0 };
    }

    if (normalized.startsWith('UPDATE "Session"')) {
      // Handle reportS3Key update separately
      if (normalized.includes('"reportS3Key"')) {
        const reportS3Key = params[0];
        const id = params[1];
        const session = inMemoryDb.Session.find((s) => s.id === id);
        if (session) {
          session.reportS3Key = reportS3Key;
        }
        return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
      }
      // Handle end-session update (endedAt, overallScore, grade, id)
      const endedAt = params[0];
      const overallScore = params[1];
      const grade = params[2];
      const id = params[3];
      const session = inMemoryDb.Session.find((s) => s.id === id);
      if (session) {
        session.endedAt = endedAt;
        session.overallScore = overallScore;
        session.grade = grade;
      }
      return { rows: session ? [session] : [], rowCount: session ? 1 : 0 };
    }

    if (normalized.includes('SELECT COUNT(*) FROM "Session" WHERE "userId" =') && normalized.includes('"endedAt" IS NOT NULL')) {
      const userId = params[0];
      const count = inMemoryDb.Session.filter((s) => s.userId === userId && s.endedAt !== null).length;
      return { rows: [{ count: count.toString() }], rowCount: 1 };
    }

    if (normalized.includes('SELECT * FROM "Session" WHERE "userId" =') && normalized.includes('"endedAt" IS NOT NULL')) {
      const userId = params[0];
      let sessions = inMemoryDb.Session.filter((s) => s.userId === userId && s.endedAt !== null);
      const sorted = sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return { rows: sorted, rowCount: sorted.length };
    }

    // --- QUESTION QUERIES ---
    if (normalized.startsWith('INSERT INTO "Question"')) {
      const question = {
        id: params[0],
        sessionId: params[1],
        questionText: params[2],
        questionType: params[3],
        difficulty: params[4],
        orderIndex: params[5],
      };
      inMemoryDb.Question.push(question);
      return { rows: [question], rowCount: 1 };
    }

    if (normalized.includes('SELECT * FROM "Question" WHERE "sessionId" =') && normalized.includes('ORDER BY "orderIndex" ASC')) {
      const sessionId = params[0];
      const matches = inMemoryDb.Question.filter((q) => q.sessionId === sessionId).sort(
        (a, b) => a.orderIndex - b.orderIndex
      );
      return { rows: matches, rowCount: matches.length };
    }

    if (normalized.includes('SELECT q."questionText", a."answerText"') && normalized.includes('WHERE q."sessionId" =')) {
      // Chat history query for AI context
      const sessionId = params[0];
      const questions = inMemoryDb.Question.filter((q) => q.sessionId === sessionId).sort(
        (a, b) => a.orderIndex - b.orderIndex
      );
      const rows = questions.map((q) => {
        const answer = inMemoryDb.Answer.find((a) => a.questionId === q.id);
        return {
          questionText: q.questionText,
          answerText: answer?.answerText || null,
        };
      });
      return { rows, rowCount: rows.length };
    }

    if (normalized.includes('SELECT q.*, a.id as "answerId"') && normalized.includes('WHERE q."sessionId" =') && normalized.includes('ORDER BY q."orderIndex" DESC LIMIT 1')) {
      // Feedback-stream query: INNER JOIN - only return questions with both answer AND score
      const sessionId = params[0];
      const questions = inMemoryDb.Question.filter((q) => q.sessionId === sessionId);
      const rows = questions
        .map((q) => {
          const answer = inMemoryDb.Answer.find((a) => a.questionId === q.id);
          if (!answer) return null;
          const score = inMemoryDb.Score.find((s) => s.answerId === answer.id);
          if (!score) return null;
          return {
            ...q,
            answerId: answer.id,
            answerUserId: answer.userId,
            answerText: answer.answerText,
            wordCount: answer.wordCount,
            submittedAt: answer.submittedAt,
            scoreId: score.id,
            starScore: score.starScore,
            techDepthScore: score.techDepthScore,
            commScore: score.commScore,
            relevanceScore: score.relevanceScore,
            confidenceScore: score.confidenceScore,
            concisenessScore: score.concisenessScore,
            overallScore: score.overallScore,
            aiFeedbackJson: score.aiFeedbackJson,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.orderIndex - a.orderIndex)
        .slice(0, 1);
      return { rows, rowCount: rows.length };
    }

    if (normalized.includes('SELECT q.*, a.id as "answerId"') && normalized.includes('WHERE q."sessionId" =')) {
      const sessionId = params[0];
      const questions = inMemoryDb.Question.filter((q) => q.sessionId === sessionId);
      const rows = questions.map((q) => {
        const answer = inMemoryDb.Answer.find((a) => a.questionId === q.id);
        const score = answer ? inMemoryDb.Score.find((s) => s.answerId === answer.id) : null;
        return {
          ...q,
          answerId: answer?.id || null,
          answerUserId: answer?.userId || null,
          answerText: answer?.answerText || null,
          wordCount: answer?.wordCount || null,
          submittedAt: answer?.submittedAt || null,
          scoreId: score?.id || null,
          starScore: score?.starScore || null,
          techDepthScore: score?.techDepthScore || null,
          commScore: score?.commScore || null,
          relevanceScore: score?.relevanceScore || null,
          confidenceScore: score?.confidenceScore || null,
          concisenessScore: score?.concisenessScore || null,
          overallScore: score?.overallScore || null,
          aiFeedbackJson: score?.aiFeedbackJson || null,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // --- ANSWER QUERIES ---
    if (normalized.startsWith('INSERT INTO "Answer"')) {
      const answer = {
        id: params[0],
        questionId: params[1],
        userId: params[2],
        answerText: params[3],
        wordCount: params[4],
        submittedAt: new Date(),
      };
      inMemoryDb.Answer.push(answer);
      return { rows: [answer], rowCount: 1 };
    }

    // --- SCORE QUERIES ---
    if (normalized.startsWith('INSERT INTO "Score"')) {
      const score = {
        id: params[0],
        answerId: params[1],
        starScore: params[2],
        techDepthScore: params[3],
        commScore: params[4],
        relevanceScore: params[5],
        confidenceScore: params[6],
        concisenessScore: params[7],
        overallScore: params[8],
        aiFeedbackJson: typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9],
      };
      inMemoryDb.Score.push(score);
      return { rows: [score], rowCount: 1 };
    }

    // --- BADGE QUERIES ---
    if (normalized.includes('SELECT 1 FROM "Badge" WHERE "userId" =') && normalized.includes('"badgeType" =')) {
      const userId = params[0];
      const badgeType = params[1];
      const exists = inMemoryDb.Badge.some((b) => b.userId === userId && b.badgeType === badgeType);
      return { rows: exists ? [{ 1: 1 }] : [], rowCount: exists ? 1 : 0 };
    }

    if (normalized.startsWith('INSERT INTO "Badge"')) {
      const badge = {
        id: params[0],
        userId: params[1],
        badgeType: params[2],
        earnedAt: new Date(),
      };
      inMemoryDb.Badge.push(badge);
      return { rows: [badge], rowCount: 1 };
    }

    if (normalized.includes('SELECT * FROM "Badge" WHERE "userId" =')) {
      const userId = params[0];
      const matches = inMemoryDb.Badge.filter((b) => b.userId === userId);
      return { rows: matches, rowCount: matches.length };
    }

    // --- DASHBOARD / STATS QUERIES ---
    if (normalized.includes('SELECT COUNT(*)::int FROM "Answer" WHERE "userId" =')) {
      const userId = params[0];
      const count = inMemoryDb.Answer.filter((a) => a.userId === userId).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    if (normalized.includes('SELECT s.* FROM "Score" s JOIN "Answer" a ON s."answerId" = a.id JOIN "Question" q ON a."questionId" = q.id JOIN "Session" se ON q."sessionId" = se.id WHERE se."userId" =') && normalized.includes('se."endedAt" IS NOT NULL')) {
      const userId = params[0];
      const userSessions = inMemoryDb.Session.filter(s => s.userId === userId && s.endedAt !== null).map(s => s.id);
      const userQuestions = inMemoryDb.Question.filter(q => userSessions.includes(q.sessionId)).map(q => q.id);
      const userAnswers = inMemoryDb.Answer.filter(a => userQuestions.includes(a.questionId)).map(a => a.id);
      const userScores = inMemoryDb.Score.filter(s => userAnswers.includes(s.answerId));
      return { rows: userScores, rowCount: userScores.length };
    }

    if (normalized.includes('SELECT id, "overallScore", "endedAt", role FROM "Session" WHERE "userId" =') && normalized.includes('ORDER BY "endedAt" ASC LIMIT')) {
      const userId = params[0];
      const limit = params[1] || 10;
      const sessions = inMemoryDb.Session.filter((s) => s.userId === userId && s.endedAt !== null)
        .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())
        .slice(0, limit);
      return {
        rows: sessions.map(s => ({
          id: s.id,
          overallScore: s.overallScore,
          endedAt: s.endedAt,
          role: s.role
        })),
        rowCount: sessions.length
      };
    }

    if (normalized.includes('SELECT s.* FROM "Score" s JOIN "Answer" a ON s."answerId" = a.id JOIN "Question" q ON a."questionId" = q.id WHERE q."sessionId" = (SELECT id FROM "Session" WHERE "userId" =')) {
      const userId = params[0];
      const latestSession = inMemoryDb.Session.filter(s => s.userId === userId && s.endedAt !== null)
        .sort((a,b) => b.endedAt.getTime() - a.endedAt.getTime())[0];
      if (!latestSession) {
        return { rows: [], rowCount: 0 };
      }
      const qIds = inMemoryDb.Question.filter(q => q.sessionId === latestSession.id).map(q => q.id);
      const aIds = inMemoryDb.Answer.filter(a => qIds.includes(a.questionId)).map(a => a.id);
      const scores = inMemoryDb.Score.filter(s => aIds.includes(s.answerId));
      return { rows: scores, rowCount: scores.length };
    }

    if (normalized.includes('SELECT "startedAt", "overallScore" FROM "Session"')) {
      const userId = params[0];
      const sessions = inMemoryDb.Session.filter((s) => s.userId === userId && s.endedAt !== null)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .map((s) => ({ startedAt: s.startedAt, overallScore: s.overallScore }));
      return { rows: sessions, rowCount: sessions.length };
    }

    if (normalized.includes('SELECT "badgeType" FROM "Badge" WHERE "userId" =')) {
      const userId = params[0];
      const badges = inMemoryDb.Badge.filter((b) => b.userId === userId).map((b) => ({ badgeType: b.badgeType }));
      return { rows: badges, rowCount: badges.length };
    }

    return { rows: [], rowCount: 0 };
  }

  async end() {}
}

async function dbPlugin(fastify: FastifyInstance) {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/techprep';
  
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 2000,
  });

  let activeDb: pg.Pool | MockPool;

  try {
    const client = await pool.connect();
    fastify.log.info('Successfully connected to PostgreSQL database');
    client.release();
    activeDb = pool;

    const ddlQuery = `
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT,
        "name" TEXT NOT NULL,
        "avatarUrl" TEXT,
        "provider" TEXT DEFAULT 'email',
        "roleTarget" TEXT NOT NULL,
        "experienceLevel" TEXT NOT NULL,
        "isPro" BOOLEAN DEFAULT FALSE,
        "streak" INTEGER DEFAULT 0,
        "lastActiveDate" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Resume" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
        "s3Key" TEXT NOT NULL,
        "parsedJson" JSONB NOT NULL,
        "uploadedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
        "interviewType" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "durationMins" INTEGER NOT NULL,
        "overallScore" DOUBLE PRECISION,
        "grade" TEXT,
        "reportS3Key" TEXT,
        "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "endedAt" TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Question" (
        "id" TEXT PRIMARY KEY,
        "sessionId" TEXT REFERENCES "Session"("id") ON DELETE CASCADE,
        "questionText" TEXT NOT NULL,
        "questionType" TEXT NOT NULL,
        "difficulty" TEXT NOT NULL,
        "orderIndex" INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Answer" (
        "id" TEXT PRIMARY KEY,
        "questionId" TEXT UNIQUE REFERENCES "Question"("id") ON DELETE CASCADE,
        "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
        "answerText" TEXT NOT NULL,
        "wordCount" INTEGER NOT NULL,
        "submittedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Score" (
        "id" TEXT PRIMARY KEY,
        "answerId" TEXT UNIQUE REFERENCES "Answer"("id") ON DELETE CASCADE,
        "starScore" DOUBLE PRECISION NOT NULL,
        "techDepthScore" DOUBLE PRECISION NOT NULL,
        "commScore" DOUBLE PRECISION NOT NULL,
        "relevanceScore" DOUBLE PRECISION NOT NULL,
        "confidenceScore" DOUBLE PRECISION NOT NULL,
        "concisenessScore" DOUBLE PRECISION NOT NULL,
        "overallScore" DOUBLE PRECISION NOT NULL,
        "aiFeedbackJson" JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Badge" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
        "badgeType" TEXT NOT NULL,
        "earnedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(ddlQuery);
    fastify.log.info('PostgreSQL schema initialized successfully');
  } catch (err) {
    fastify.log.warn('PostgreSQL connection failed. Falling back to an in-memory database mock for testing.');
    activeDb = new MockPool();
  }

  fastify.decorate('db', activeDb);

  fastify.addHook('onClose', async (server) => {
    if (server.db instanceof pg.Pool) {
      await server.db.end();
    }
  });
}

export default fp(dbPlugin);
