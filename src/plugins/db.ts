import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

async function dbPlugin(fastify: FastifyInstance) {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/techprep';
  
  const pool = new pg.Pool({
    connectionString,
  });

  // Test the connection
  try {
    const client = await pool.connect();
    fastify.log.info('Successfully connected to PostgreSQL database');
    client.release();
  } catch (err) {
    fastify.log.error(err, 'Failed to connect to PostgreSQL database');
    throw err;
  }

  // Initialize DB Schema DDL
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

  try {
    await pool.query(ddlQuery);
    fastify.log.info('PostgreSQL schema initialized successfully');
  } catch (err) {
    fastify.log.error(err, 'Failed to initialize database schema');
    throw err;
  }

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async (server) => {
    await server.db.end();
  });
}

export default fp(dbPlugin);
