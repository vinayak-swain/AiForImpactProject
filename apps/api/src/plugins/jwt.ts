import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    authorize: (roles: string[]) => (request: any, reply: any) => Promise<void>;
    authorizePro: (request: any, reply: any) => Promise<void>;
  }
}

async function jwtPlugin(fastify: FastifyInstance) {
  const jwtSecret = process.env.JWT_SECRET || 'super-secret-jwt-key';
  const cookieSecret = process.env.COOKIE_SECRET || 'super-secret-cookie-key';

  await fastify.register(fastifyCookie, {
    secret: cookieSecret,
    hook: 'onRequest',
  });

  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: 'refreshToken',
      signed: true,
    },
    sign: {
      expiresIn: '15m', // Short-lived access token
    },
  });

  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired access token',
      });
    }
  });

  fastify.decorate('authorize', (roles: string[]) => {
    return async (request: any, reply: any) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      }
      const userRole = request.user.role || 'user';
      if (!roles.includes(userRole)) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied: insufficient permissions' });
      }
    };
  });

  fastify.decorate('authorizePro', async (request: any, reply: any) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const userId = request.user.sub;
    const userRes = await fastify.db.query('SELECT "isPro", role FROM "User" WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user || (!user.isPro && user.role !== 'admin')) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied: premium subscription required' });
    }
  });
}

export default fp(jwtPlugin);
