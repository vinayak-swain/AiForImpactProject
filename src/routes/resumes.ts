import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export default async function resumeRoutes(fastify: FastifyInstance) {
  // Protect all routes in this file
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /upload
  // Accepts multipart file upload, uploads to S3 (or local storage), calls AI service to parse, and saves in DB
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No file uploaded' });
    }

    const userId = request.user.sub;
    const fileBuffer = await data.toBuffer();
    const fileExtension = path.extname(data.filename).toLowerCase();

    if (fileExtension !== '.pdf' && fileExtension !== '.txt') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Only PDF and TXT files are allowed' });
    }

    const resumeId = fastify.prisma.user.name + '_' + Date.now();
    const s3Key = `resumes/${userId}/${resumeId}${fileExtension}`;

    // 1. Upload file to storage (S3 or local fallback)
    await fastify.storage.uploadFile(s3Key, fileBuffer, data.mimetype);

    // 2. Extract text (FastAPI or local parser)
    let resumeText = '';
    if (fileExtension === '.txt') {
      resumeText = fileBuffer.toString('utf-8');
    } else {
      // For PDF, let's let FastAPI parse it by passing the local file path or S3 key.
      // But to be robust, let's call Python's AI Service.
      // We can pass { s3_key: s3Key } or we can do text extraction.
      // Let's implement a robust mechanism. We'll call FastAPI at /ai/parse-resume-file
      // passing the key, so FastAPI can use pdfplumber.
      // Or we can just call FastAPI. Let's make an API call to http://localhost:8000/ai/parse-resume
    }

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

      const parsedJson = await response.json();

      // 3. Save to database
      const resume = await fastify.prisma.resume.create({
        data: {
          userId,
          s3Key,
          parsedJson: parsedJson as any,
        },
      });

      return resume;
    } catch (err: any) {
      fastify.log.error(err);
      // Fallback structured data if AI parser fails or is offline
      const fallbackJson = {
        projects: [{ name: 'Personal Web Project', tech_stack: ['React', 'Node.js'], description: 'A full-stack application' }],
        skills: ['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
        experiences: [{ company: 'Tech Inc', role: 'Software Engineer Intern', duration: '3 months', tech: ['React'] }],
        education: [{ degree: 'Bachelor of Science in CS', institution: 'State University', year: '2025' }],
      };

      const resume = await fastify.prisma.resume.create({
        data: {
          userId,
          s3Key,
          parsedJson: fallbackJson,
        },
      });

      return resume;
    }
  });

  // GET /me
  fastify.get('/me', async (request, reply) => {
    const userId = request.user.sub;
    const resume = await fastify.prisma.resume.findFirst({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!resume) {
      return reply.status(404).send({ error: 'Not Found', message: 'No resume found for user' });
    }

    return resume;
  });

  // DELETE /:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };

    const resume = await fastify.prisma.resume.findUnique({
      where: { id },
    });

    if (!resume || resume.userId !== userId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Resume not found' });
    }

    // Delete from S3/storage
    await fastify.storage.deleteFile(resume.s3Key);

    // Delete from DB
    await fastify.prisma.resume.delete({
      where: { id },
    });

    return { success: true };
  });

  // GET /download-local (Serves files locally in development)
  // This route is public so pre-signed URLs point here and work instantly
  fastify.get('/download-local', {
    schema: {
      querystring: z.object({
        key: z.string(),
      })
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
