import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  WX_APPID: z.string().optional().default(''),
  WX_APPSECRET: z.string().optional().default(''),
  PAYMENT_MODE: z.enum(['mock', 'wechat']).default('mock'),
  PUBLIC_BASE_URL: z.string().default('http://127.0.0.1:8787'),
});

export const config = schema.parse(process.env);
