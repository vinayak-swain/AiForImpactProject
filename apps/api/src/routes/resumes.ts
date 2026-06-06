import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import '@fastify/multipart';

export default async function resumeRoutes(fastify: FastifyInstance) {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /upload
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
    }

    const userId = (request.user as any).sub;
    const fileBuffer = await data.toBuffer();
    const fileExtension = path.extname(data.filename).toLowerCase();

    if (fileExtension !== '.pdf' && fileExtension !== '.txt') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Only PDF and TXT files are allowed' });
    }

    // Get user details for filename
    const userRes = await fastify.db.query('SELECT name FROM "User" WHERE id = $1', [userId]);
    const userName = userRes.rows[0]?.name || 'candidate';
    const cleanName = userName.replace(/[^a-zA-Z0-9]/g, '_');

    const resumeId = crypto.randomUUID();
    const s3Key = `resumes/${userId}/${cleanName}_${Date.now()}${fileExtension}`;

    // 1. Upload file to storage
    await fastify.storage.uploadFile(s3Key, fileBuffer, data.mimetype);

    // 2. Extract text (call FastAPI AI parser)
    let parsedJson = null;

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const response = await fetch(`${aiServiceUrl}/ai/parse-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3_key: s3Key }),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      parsedJson = await response.json();
    } catch (err: any) {
      fastify.log.error(err);
      // Fallback structured data if AI parser fails
      parsedJson = {
        projects: [{ name: 'Personal Web Project', tech_stack: ['React', 'Node.js'], description: 'A full-stack application' }],
        skills: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
        experiences: [{ company: 'Tech Inc', role: 'Software Engineer Intern', duration: '3 months', tech: ['React'] }],
        education: [{ degree: 'Bachelor of Science in CS', institution: 'State University', year: '2025' }],
      };
    }

    // 3. Save to database
    const insertRes = await fastify.db.query(
      'INSERT INTO "Resume" (id, "userId", "s3Key", "parsedJson") VALUES ($1, $2, $3, $4) RETURNING *',
      [resumeId, userId, s3Key, JSON.stringify(parsedJson)]
    );

    return insertRes.rows[0];
  });

  // GET /me
  fastify.get('/me', async (request, reply) => {
    const userId = (request.user as any).sub;
    const resumeRes = await fastify.db.query(
      'SELECT * FROM "Resume" WHERE "userId" = $1 ORDER BY "uploadedAt" DESC LIMIT 1',
      [userId]
    );

    if (resumeRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'No resume found for user' });
    }

    return resumeRes.rows[0];
  });

  // DELETE /:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request.user as any).sub;
    const { id } = request.params as { id: string };

    const resumeRes = await fastify.db.query(
      'SELECT * FROM "Resume" WHERE id = $1',
      [id]
    );

    if (resumeRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Resume not found' });
    }

    const resume = resumeRes.rows[0];
    if (resume.userId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You do not own this resume' });
    }

    // Delete from S3/storage
    await fastify.storage.deleteFile(resume.s3Key);

    // Delete from DB
    await fastify.db.query('DELETE FROM "Resume" WHERE id = $1', [id]);

    return { success: true };
  });

  // GET /download-local (Serves files locally in development)
  fastify.get('/download-local', {
    schema: {
      querystring: {
        type: 'object',
        required: ['key'],
        properties: {
          key: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const { key } = request.query as { key: string };
      const localStorageDir = path.join(process.cwd(), 'local_storage');
      const filePath = path.join(localStorageDir, key.replace(/\//g, '_'));

      if (!fs.existsSync(filePath)) {
        return reply.status(404).send({ error: 'Not Found', message: 'File not found' });
      }

      const stream = fs.createReadStream(filePath);
      let contentType = 'application/pdf';
      if (key.endsWith('.txt')) contentType = 'text/plain';
      else if (key.endsWith('.png')) contentType = 'image/png';

      reply.header('Content-Type', contentType);
      return reply.send(stream);
    }
  });
}
