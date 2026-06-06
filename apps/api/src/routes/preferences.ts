import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const PreferenceSchema = z.object({
  theme: z.enum(['light', 'dark']),
});

export default async function preferenceRoutes(fastify: FastifyInstance) {
  // POST /preferences
  fastify.post('/preferences', async (request, reply) => {
    const { theme } = PreferenceSchema.parse(request.body);
    
    reply.setCookie('theme', theme, {
      path: '/',
      httpOnly: false,
      secure: false, // development friendly
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60, // 1 year
    });

    return { success: true, theme };
  });
}
