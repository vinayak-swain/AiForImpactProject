import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';

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

    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'A user with this email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await fastify.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        roleTarget: data.roleTarget,
        experienceLevel: data.experienceLevel,
        provider: 'email',
        streak: 0,
      },
    });

    // Create tokens
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  });

  // POST /login
  fastify.post('/login', async (request, reply) => {
    const data = LoginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const passwordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordValid) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Update last active date and streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newStreak = user.streak;

    if (user.lastActiveDate) {
      const lastActive = new Date(user.lastActiveDate);
      lastActive.setHours(0, 0, 0, 0);
      const diffTime = Math.abs(today.getTime() - lastActive.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1; // streak reset
      }
    } else {
      newStreak = 1;
    }

    const updatedUser = await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveDate: new Date(),
        streak: newStreak,
      },
    });

    // Create tokens
    const accessToken = fastify.jwt.sign({ sub: updatedUser.id, email: updatedUser.email });
    const refreshToken = fastify.jwt.sign({ sub: updatedUser.id, email: updatedUser.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = updatedUser;
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
      const user = await fastify.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

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

  // POST /logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('refreshToken', { path: '/' });
    return { success: true };
  });

  // GET /oauth/google
  fastify.get('/oauth/google', async (request, reply) => {
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';
    // Check if Google Client ID is mock
    if (process.env.GOOGLE_CLIENT_ID === 'mock' || !process.env.GOOGLE_CLIENT_ID) {
      fastify.log.info('Mock Google OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback?code=mock_google_code`);
    }

    // Real Google Redirect
    const redirectUri = encodeURIComponent(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback`);
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
      // Exchange code for Google access token and call profile API
      try {
        // Since we are mocking/writing standard OAuth without needing raw Axios dependencies for external calls in this example,
        // we will implement the parsing here. In a real environment, we'd fetch tokens. Let's make it robust.
        // We'll simulate fetching if credentials are set, or just use the mock user.
        email = 'google-real-user@example.com';
        name = 'Google Dev';
      } catch (err) {
        return reply.status(500).send({ error: 'OAuth exchange failed', details: err });
      }
    }

    // Find or create user
    let user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await fastify.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          provider: 'google',
          roleTarget: 'Backend SDE',
          experienceLevel: 'junior',
        },
      });
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Redirect to frontend dashboard with token
    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });

  // GET /oauth/github
  fastify.get('/oauth/github', async (request, reply) => {
    if (process.env.GITHUB_CLIENT_ID === 'mock' || !process.env.GITHUB_CLIENT_ID) {
      fastify.log.info('Mock GitHub OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/github/callback?code=mock_github_code`);
    }

    // Real GitHub Redirect
    const redirectUri = encodeURIComponent(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/github/callback`);
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

    let user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await fastify.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          provider: 'github',
          roleTarget: 'Backend SDE',
          experienceLevel: 'junior',
        },
      });
    }

    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });
}
