import fastify from 'fastify';
import cors from '@fastify/cors';
import * as dotenv from 'dotenv';
import dbPlugin from './plugins/db.js';
import redisPlugin from './plugins/redis.js';
import s3Plugin from './plugins/s3.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';
import resumeRoutes from './routes/resumes.js';
import sessionRoutes from './routes/sessions.js';
import dashboardRoutes from './routes/dashboard.js';
import { setupErrorHandler } from './utils/errors.js';

dotenv.config();

const server = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function main() {
  // Register CORS
  await server.register(cors, {
    origin: process.env.WEB_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register Custom Plugins
  await server.register(dbPlugin);
  await server.register(redisPlugin);
  await server.register(s3Plugin);
  await server.register(jwtPlugin);

  // Setup Error Handler
  setupErrorHandler(server);

  // Register Routes
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(resumeRoutes, { prefix: '/api/resumes' });
  await server.register(sessionRoutes, { prefix: '/api/sessions' });
  await server.register(dashboardRoutes, { prefix: '/api/dashboard' });

  // Health check route
  server.get('/health', async () => {
    return { status: 'OK', timestamp: new Date() };
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  try {
    await server.listen({ port, host });
    server.log.info(`Fastify server running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
