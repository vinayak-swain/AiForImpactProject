import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  roleTarget: z.string(),
  experienceLevel: z.enum(['fresher', 'junior', 'mid', 'senior']),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // Custom Redis-based rate limiter to protect sensitive authentication endpoints
  const authRateLimiter = async (request: any, reply: any) => {
    // Skip rate limiting if Redis is unavailable or offline
    if (!fastify.redis || fastify.redis.status !== 'ready') {
      return;
    }

    try {
      const ip = request.ip;
      const key = `rate_limit:auth:${ip}`;
      const current = await fastify.redis.incr(key);
      if (current === 1) {
        await fastify.redis.expire(key, 60); // 1-minute window
      }
      if (current > 10) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again after 60 seconds.',
        });
      }
    } catch (err) {
      fastify.log.error(err, 'Rate limiter error');
    }
  };

  // POST /register
  fastify.post('/register', { preHandler: [authRateLimiter] }, async (request, reply) => {
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
      'INSERT INTO "User" (id, name, email, "passwordHash", "roleTarget", "experienceLevel", provider, streak, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [userId, data.name, data.email, passwordHash, data.roleTarget, data.experienceLevel, 'email', 0, 'user']
    );

    const user = insertRes.rows[0];

    // Create tokens
    const tokenId = crypto.randomUUID();
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email, jti: tokenId }, { expiresIn: '7d' });

    // Save refresh token to Redis with 7-day TTL if Redis is online
    if (fastify.redis && fastify.redis.status === 'ready') {
      await fastify.redis.setex(`refresh_token:${tokenId}`, 7 * 24 * 60 * 60, user.id);
    }

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  });

  // POST /login
  fastify.post('/login', { preHandler: [authRateLimiter] }, async (request, reply) => {
    const data = LoginSchema.parse(request.body);

    const userRes = await fastify.db.query(
      'SELECT * FROM "User" WHERE email = $1',
      [data.email]
    );

    const user = userRes.rows[0];

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Traditional local account must have a password hash and match
    if (user.provider === 'email' || user.passwordHash) {
      const isMatch = await bcrypt.compare(data.password, user.passwordHash || '');
      if (!isMatch) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }
    } else {
      // Social login accounts cannot log in via credentials unless linked
      return reply.status(400).send({
        error: 'Bad Request',
        message: `This email is registered with ${user.provider}. Please log in via social authentication.`,
      });
    }

    // Create tokens
    const tokenId = crypto.randomUUID();
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email, jti: tokenId }, { expiresIn: '7d' });

    // Save refresh token to Redis with 7-day TTL if Redis is online
    if (fastify.redis && fastify.redis.status === 'ready') {
      await fastify.redis.setex(`refresh_token:${tokenId}`, 7 * 24 * 60 * 60, user.id);
    }

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return { accessToken, user: userWithoutPassword };
  });

  // POST /refresh
  fastify.post('/refresh', { preHandler: [authRateLimiter] }, async (request, reply) => {
    const refreshTokenCookie = request.cookies.refreshToken;
    if (!refreshTokenCookie) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No refresh token provided',
      });
    }

    // Unsign the cookie manually
    const unsigned = request.unsignCookie(refreshTokenCookie);
    if (!unsigned.valid || !unsigned.value) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    const refreshToken = unsigned.value;

    try {
      const payload: any = fastify.jwt.verify(refreshToken);
      const tokenId = payload.jti;

      if (!tokenId) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Malformed refresh token payload',
        });
      }

      // Check if refresh token is in Redis (revocation check) if Redis is online
      if (fastify.redis && fastify.redis.status === 'ready') {
        const redisUserId = await fastify.redis.get(`refresh_token:${tokenId}`);
        if (!redisUserId) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Session has expired or been revoked',
          });
        }
        // Delete the old refresh token from Redis
        await fastify.redis.del(`refresh_token:${tokenId}`);
      }

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

      // Issue a new access token and a new rotated refresh token
      const newTokenId = crypto.randomUUID();
      const nextAccessToken = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      const nextRefreshToken = fastify.jwt.sign({ sub: user.id, email: user.email, jti: newTokenId }, { expiresIn: '7d' });

      // Save rotated refresh token in Redis if online
      if (fastify.redis && fastify.redis.status === 'ready') {
        await fastify.redis.setex(`refresh_token:${newTokenId}`, 7 * 24 * 60 * 60, user.id);
      }

      reply.setCookie('refreshToken', nextRefreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        signed: true,
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      const { passwordHash: _, ...userWithoutPassword } = user;
      return { accessToken: nextAccessToken, user: userWithoutPassword };
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }
  });

  // POST /logout
  fastify.post('/logout', async (request, reply) => {
    const refreshTokenCookie = request.cookies.refreshToken;
    if (refreshTokenCookie && fastify.redis && fastify.redis.status === 'ready') {
      const unsigned = request.unsignCookie(refreshTokenCookie);
      if (unsigned.valid && unsigned.value) {
        try {
          const payload: any = fastify.jwt.decode(unsigned.value);
          if (payload && payload.jti) {
            await fastify.redis.del(`refresh_token:${payload.jti}`);
          }
        } catch (err) {
          // Ignore decode errors on logout
        }
      }
    }

    reply.clearCookie('refreshToken', { path: '/', signed: true });
    return { success: true };
  });

  // GET /oauth/google
  fastify.get('/oauth/google', { preHandler: [authRateLimiter] }, async (request, reply) => {
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state', state, {
      path: '/',
      httpOnly: true,
      maxAge: 300, // 5 minutes
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
    });

    if (process.env.GOOGLE_CLIENT_ID === 'mock' || !process.env.GOOGLE_CLIENT_ID) {
      fastify.log.info('Mock Google OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback?code=mock_google_code&state=${state}`);
    }

    const redirectUri = encodeURIComponent(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback`);
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${state}`;
    return reply.redirect(googleAuthUrl);
  });

  // GET /oauth/google/callback
  fastify.get('/oauth/google/callback', async (request, reply) => {
    const query: any = request.query;
    const { code, state: queryState } = query;
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    // CSRF Validation
    const cookieState = request.cookies.oauth_state;
    if (!cookieState) {
      return reply.redirect(`${webUrl}/login?error=state_missing`);
    }

    const unsignedState = request.unsignCookie(cookieState);
    if (!unsignedState.valid || unsignedState.value !== queryState) {
      return reply.redirect(`${webUrl}/login?error=state_mismatch`);
    }

    reply.clearCookie('oauth_state', { path: '/' });

    let email = 'google-user@example.com';
    let name = 'Google Candidate';
    let avatarUrl = 'https://lh3.googleusercontent.com/a/default-user';
    let googleId = 'mock_google_id';

    if (code !== 'mock_google_code' && process.env.GOOGLE_CLIENT_ID !== 'mock' && process.env.GOOGLE_CLIENT_ID) {
      try {
        const redirectUri = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/google/callback`;
        const tokenUrl = 'https://oauth2.googleapis.com/token';

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          fastify.log.error(`Google token exchange failed: ${errorText}`);
          return reply.redirect(`${webUrl}/login?error=google_auth_failed`);
        }

        const tokenData: any = await tokenResponse.json();
        const googleAccessToken = tokenData.access_token;

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${googleAccessToken}` },
        });

        if (!userInfoResponse.ok) {
          fastify.log.error('Google userInfo request failed');
          return reply.redirect(`${webUrl}/login?error=google_user_failed`);
        }

        const profile: any = await userInfoResponse.json();
        email = profile.email;
        name = profile.name || email.split('@')[0];
        avatarUrl = profile.picture || avatarUrl;
        googleId = profile.sub;
      } catch (err: any) {
        fastify.log.error(err, 'Error executing Google OAuth callback flow');
        return reply.redirect(`${webUrl}/login?error=google_internal_error`);
      }
    }

    // Find linked account
    const identityRes = await fastify.db.query(
      'SELECT "userId" FROM "UserIdentity" WHERE provider = $1 AND "providerId" = $2',
      ['google', googleId]
    );

    let user;
    if (identityRes.rowCount && identityRes.rowCount > 0) {
      const userId = identityRes.rows[0].userId;
      const userRes = await fastify.db.query('SELECT * FROM "User" WHERE id = $1', [userId]);
      user = userRes.rows[0];
    }

    if (!user) {
      // Check if user email already exists (traditional account or another social provider)
      const emailUserRes = await fastify.db.query(
        'SELECT * FROM "User" WHERE email = $1',
        [email]
      );

      if (emailUserRes.rowCount && emailUserRes.rowCount > 0) {
        user = emailUserRes.rows[0];

        // Link Google provider identity to existing user
        await fastify.db.query(
          'INSERT INTO "UserIdentity" (id, "userId", provider, "providerId") VALUES ($1, $2, $3, $4)',
          [crypto.randomUUID(), user.id, 'google', googleId]
        );

        if (!user.provider.includes('google')) {
          const newProvider = user.provider ? `${user.provider},google` : 'google';
          await fastify.db.query(
            'UPDATE "User" SET provider = $1 WHERE id = $2',
            [newProvider, user.id]
          );
          user.provider = newProvider;
        }
      } else {
        // Create new user & identity link
        const userId = crypto.randomUUID();
        const insertRes = await fastify.db.query(
          'INSERT INTO "User" (id, email, name, "avatarUrl", provider, "roleTarget", "experienceLevel", role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
          [userId, email, name, avatarUrl, 'google', 'Backend SDE', 'junior', 'user']
        );
        user = insertRes.rows[0];

        await fastify.db.query(
          'INSERT INTO "UserIdentity" (id, "userId", provider, "providerId") VALUES ($1, $2, $3, $4)',
          [crypto.randomUUID(), userId, 'google', googleId]
        );
      }
    }

    const tokenId = crypto.randomUUID();
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email, jti: tokenId }, { expiresIn: '7d' });

    // Store in Redis if online
    if (fastify.redis && fastify.redis.status === 'ready') {
      await fastify.redis.setex(`refresh_token:${tokenId}`, 7 * 24 * 60 * 60, user.id);
    }

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });

  // GET /oauth/github
  fastify.get('/oauth/github', { preHandler: [authRateLimiter] }, async (request, reply) => {
    const state = crypto.randomBytes(16).toString('hex');
    reply.setCookie('oauth_state', state, {
      path: '/',
      httpOnly: true,
      maxAge: 300, // 5 minutes
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
    });

    if (process.env.GITHUB_CLIENT_ID === 'mock' || !process.env.GITHUB_CLIENT_ID) {
      fastify.log.info('Mock GitHub OAuth triggered. Redirecting to callback.');
      return reply.redirect(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/github/callback?code=mock_github_code&state=${state}`);
    }

    const redirectUri = encodeURIComponent(`${process.env.API_URL || 'http://localhost:3000'}/api/auth/oauth/github/callback`);
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`;
    return reply.redirect(githubAuthUrl);
  });

  // GET /oauth/github/callback
  fastify.get('/oauth/github/callback', async (request, reply) => {
    const query: any = request.query;
    const { code, state: queryState } = query;
    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    // CSRF Validation
    const cookieState = request.cookies.oauth_state;
    if (!cookieState) {
      return reply.redirect(`${webUrl}/login?error=state_missing`);
    }

    const unsignedState = request.unsignCookie(cookieState);
    if (!unsignedState.valid || unsignedState.value !== queryState) {
      return reply.redirect(`${webUrl}/login?error=state_mismatch`);
    }

    reply.clearCookie('oauth_state', { path: '/' });

    let email = 'github-user@example.com';
    let name = 'GitHub Candidate';
    let avatarUrl = 'https://avatars.githubusercontent.com/u/9919?v=4';
    let githubId = 'mock_github_id';

    if (code !== 'mock_github_code' && process.env.GITHUB_CLIENT_ID !== 'mock' && process.env.GITHUB_CLIENT_ID) {
      try {
        const tokenUrl = 'https://github.com/login/oauth/access_token';
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET || '',
            code,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          fastify.log.error(`GitHub token exchange failed: ${errorText}`);
          return reply.redirect(`${webUrl}/login?error=github_auth_failed`);
        }

        const tokenData: any = await tokenResponse.json();
        const githubAccessToken = tokenData.access_token;

        if (!githubAccessToken) {
          fastify.log.error('GitHub token exchange did not return an access token', tokenData);
          return reply.redirect(`${webUrl}/login?error=github_token_missing`);
        }

        // Fetch user profile details
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `token ${githubAccessToken}`,
            'User-Agent': 'TechPrep-AI-Backend',
          },
        });

        if (!userResponse.ok) {
          fastify.log.error('GitHub user profile request failed');
          return reply.redirect(`${webUrl}/login?error=github_user_failed`);
        }

        const profile: any = await userResponse.json();
        name = profile.name || profile.login;
        avatarUrl = profile.avatar_url || avatarUrl;
        githubId = String(profile.id);
        email = profile.email;

        // Fallback to fetch verified email list if primary email is private/null
        if (!email) {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
              Authorization: `token ${githubAccessToken}`,
              'User-Agent': 'TechPrep-AI-Backend',
            },
          });

          if (emailsResponse.ok) {
            const emails: any[] = await emailsResponse.json();
            const primaryEmailObj = emails.find((e) => e.primary && e.verified);
            if (primaryEmailObj) {
              email = primaryEmailObj.email;
            } else if (emails.length > 0) {
              email = emails[0].email;
            }
          }
        }

        if (!email) {
          fastify.log.error('Could not retrieve a verified email from GitHub account');
          return reply.redirect(`${webUrl}/login?error=github_email_required`);
        }
      } catch (err: any) {
        fastify.log.error(err, 'Error executing GitHub OAuth callback flow');
        return reply.redirect(`${webUrl}/login?error=github_internal_error`);
      }
    }

    // Find linked account
    const identityRes = await fastify.db.query(
      'SELECT "userId" FROM "UserIdentity" WHERE provider = $1 AND "providerId" = $2',
      ['github', githubId]
    );

    let user;
    if (identityRes.rowCount && identityRes.rowCount > 0) {
      const userId = identityRes.rows[0].userId;
      const userRes = await fastify.db.query('SELECT * FROM "User" WHERE id = $1', [userId]);
      user = userRes.rows[0];
    }

    if (!user) {
      // Check if user email already exists (traditional account or another social provider)
      const emailUserRes = await fastify.db.query(
        'SELECT * FROM "User" WHERE email = $1',
        [email]
      );

      if (emailUserRes.rowCount && emailUserRes.rowCount > 0) {
        user = emailUserRes.rows[0];

        // Link GitHub provider identity to existing user
        await fastify.db.query(
          'INSERT INTO "UserIdentity" (id, "userId", provider, "providerId") VALUES ($1, $2, $3, $4)',
          [crypto.randomUUID(), user.id, 'github', githubId]
        );

        if (!user.provider.includes('github')) {
          const newProvider = user.provider ? `${user.provider},github` : 'github';
          await fastify.db.query(
            'UPDATE "User" SET provider = $1 WHERE id = $2',
            [newProvider, user.id]
          );
          user.provider = newProvider;
        }
      } else {
        // Create new user & identity link
        const userId = crypto.randomUUID();
        const insertRes = await fastify.db.query(
          'INSERT INTO "User" (id, email, name, "avatarUrl", provider, "roleTarget", "experienceLevel", role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
          [userId, email, name, avatarUrl, 'github', 'Backend SDE', 'junior', 'user']
        );
        user = insertRes.rows[0];

        await fastify.db.query(
          'INSERT INTO "UserIdentity" (id, "userId", provider, "providerId") VALUES ($1, $2, $3, $4)',
          [crypto.randomUUID(), userId, 'github', githubId]
        );
      }
    }

    const tokenId = crypto.randomUUID();
    const accessToken = fastify.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = fastify.jwt.sign({ sub: user.id, email: user.email, jti: tokenId }, { expiresIn: '7d' });

    // Store in Redis if online
    if (fastify.redis && fastify.redis.status === 'ready') {
      await fastify.redis.setex(`refresh_token:${tokenId}`, 7 * 24 * 60 * 60, user.id);
    }

    reply.setCookie('refreshToken', refreshToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.redirect(`${webUrl}/oauth-callback?token=${accessToken}`);
  });
}
