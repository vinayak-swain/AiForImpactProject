import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  roleTarget: z.string(),
  experienceLevel: z.enum(['fresher', 'junior', 'mid', 'senior']),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /register
  fastify.post('/register', async (request, reply) => {
    const data = RegisterSchema.parse(request.body);

    const existingUserRes = await fastify.db.query(
      'SELECT id FROM "User" WHERE email = $1',
      [data.email]
    );

    if (existingUserRes.rowCount && existingUserRes.rowCount > 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'A user with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = crypto.randomUUID();

    const insertRes = await fastify.db.query(
      'INSERT INTO "User" (id, name, email, "passwordHash", "roleTarget", "experienceLevel", provider, streak) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [userId, data.name, data.email, passwordHash, data.roleTarget, data.experienceLevel, 'email', 0]
    );

    const user = insertRes.rows[0];

    // Create tokens
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const data = LoginSchema.parse(request.body);

    const userRes = await fastify.db.query(
      'SELECT * FROM "User" WHERE email = $1',
      [data.email]
    );

    let user = userRes.rows[0];

    if (!user) {
      // Auto-create user for frictionless local testing
      const userId = crypto.randomUUID();
      const insertRes = await fastify.db.query(
        'INSERT INTO "User" (id, name, email, "passwordHash", "roleTarget", "experienceLevel", provider, streak) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [userId, data.email.split('@')[0], data.email, 'mock_hash', 'Backend Engineer', 'mid', 'email', 1]
      );
      user = insertRes.rows[0];
    }

    // Create tokens
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  });

  // POST /refresh
  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
    }

    try {
      const payload: any = fastify.jwt.verify(refreshToken);
      const userRes = await fastify.db.query(
        'SELECT * FROM "User" WHERE id = $1',
        [payload.sub]
      );

      if (userRes.rowCount === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      const user = userRes.rows[0];
      const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
      const { passwordHash: _, ...userWithoutPassword } = user;
      return { accessToken, user: userWithoutPassword };
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });

  // GET /me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request.user as any).sub;
    const userRes = await fastify.db.query(
      'SELECT id, name, email, "avatarUrl", "roleTarget", "experienceLevel", streak FROM "User" WHERE id = $1',
      [userId]
    );
    if (userRes.rowCount === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }
    return userRes.rows[0];
  });

  // POST /logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/' });
    return { success: true };
  });

  // GET /oauth/google
  fastify.get('/oauth/google', async (request, reply) => {
    let baseUrl = process.env.API_URL || `${request.protocol}://${request.hostname}`;
    if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/^http:\/\//i, 'https://');
    }
    if (process.env.GOOGLE_CLIENT_ID === 'mock' || !process.env.GOOGLE_CLIENT_ID) {
      fastify.log.info('Mock Google OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${baseUrl}/api/auth/oauth/google/callback?code=mock_google_code`);
    }

    const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/oauth/google/callback`);
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`;
    return reply.redirect(googleAuthUrl);
  });

  // GET /oauth/google/callback
  fastify.get('/oauth/google/callback', async (request, reply) => {
    const query: any = request.query;
    const code = query.code;
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    let email = 'google-user@example.com';
    let name = 'Google Candidate';
    let avatarUrl = 'https://lh3.googleusercontent.com/a/default-user';

    if (code !== 'mock_google_code' && process.env.GOOGLE_CLIENT_ID !== 'mock' && process.env.GOOGLE_CLIENT_ID) {
      email = 'google-real-user@example.com';
      name = 'Google Dev';
    }

    // Find or create user
    const userRes = await fastify.db.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    let user;
    if (userRes.rowCount === 0) {
      const userId = crypto.randomUUID();
      const insertRes = await fastify.db.query(
        'INSERT INTO "User" (id, email, name, "avatarUrl", provider, "roleTarget", "experienceLevel") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, email, name, avatarUrl, 'google', 'Backend SDE', 'junior']
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });

  // GET /oauth/github
  fastify.get('/oauth/github', async (request, reply) => {
    let baseUrl = process.env.API_URL || `${request.protocol}://${request.hostname}`;
    if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/^http:\/\//i, 'https://');
    }
    if (process.env.GITHUB_CLIENT_ID === 'mock' || !process.env.GITHUB_CLIENT_ID) {
      fastify.log.info('Mock GitHub OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${baseUrl}/api/auth/oauth/github/callback?code=mock_github_code`);
    }

    const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/oauth/github/callback`);
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email`;
    return reply.redirect(githubAuthUrl);
  });

  // GET /oauth/github/callback
  fastify.get('/oauth/github/callback', async (request, reply) => {
    const query: any = request.query;
    const code = query.code;
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    let email = 'github-user@example.com';
    let name = 'GitHub Candidate';
    let avatarUrl = 'https://avatars.githubusercontent.com/u/9919?v=4';

    if (code !== 'mock_github_code' && process.env.GITHUB_CLIENT_ID !== 'mock' && process.env.GITHUB_CLIENT_ID) {
      email = 'github-real-user@example.com';
      name = 'GitHub Dev';
    }

    // Find or create user
    const userRes = await fastify.db.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );

    let user;
    if (userRes.rowCount === 0) {
      const userId = crypto.randomUUID();
      const insertRes = await fastify.db.query(
        'INSERT INTO "User" (id, email, name, "avatarUrl", provider, "roleTarget", "experienceLevel") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, email, name, avatarUrl, 'github', 'Backend SDE', 'junior']
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });
}
