import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import staticPlugin from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { publicRoutes } from './routes/public.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/user.js';
import { adminRoutes } from './routes/admin.js';
import { isAllowedOrigin, parseAllowedOrigins } from './domain/cors-origin.js';

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
const allowedOrigins = parseAllowedOrigins(config.CORS_ALLOWED_ORIGINS);

await app.register(cors, {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin, allowedOrigins));
  }
});
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
await app.register(staticPlugin, { root: path.join(process.cwd(), 'public'), prefix: '/static/' });

app.get('/health', async () => ({ ok: true, service: '鲜果铺 API', time: new Date().toISOString() }));
await app.register(publicRoutes, { prefix: '/api' });
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(userRoutes, { prefix: '/api/user' });
await app.register(adminRoutes, { prefix: '/api/admin' });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  const message = error instanceof Error ? error.message : '服务器错误';
  reply.code((error as any).statusCode || 500).send({ message });
});

const close = async () => { await prisma.$disconnect(); await app.close(); process.exit(0); };
process.on('SIGINT', close); process.on('SIGTERM', close);
await app.listen({ port: config.PORT, host: '0.0.0.0' });
