import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
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
      signed: false,
    },
    sign: {
      expiresIn: '15m', // Short-lived access token
    },
  });

  fastify.decorate('authenticate', async (request: any, reply: any) => {
    // Inject mock user profile for internal testing to bypass JWT validation
    request.user = {
      sub: 'mock-user-id-1234',
      email: 'mock-test-candidate@example.com',
    };
  });
}

export default fp(jwtPlugin);
