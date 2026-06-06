import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      // Exponential backoff: max 60 seconds between retries
      return Math.min(times * 2000, 60000);
    },
  });

  let lastErrorLog = 0;
  redis.on('error', (err) => {
    // Rate-limit error logging to once every 60 seconds
    const now = Date.now();
    if (now - lastErrorLog > 60000) {
      fastify.log.warn('Redis connection issue (will retry): ' + err.message);
      lastErrorLog = now;
    }
  });

  redis.on('connect', () => {
    fastify.log.info('Redis connected successfully');
  });

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async (server) => {
    await server.redis.quit();
  });
}

export default fp(redisPlugin);

