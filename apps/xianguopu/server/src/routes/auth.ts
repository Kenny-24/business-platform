import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/admin/login', async (req, reply) => {
    const body = req.body as { username?: string; password?: string };
    const admin = await prisma.admin.findUnique({ where: { username: body.username || '' } });
    if (!admin || !(await bcrypt.compare(body.password || '', admin.passwordHash))) {
      return reply.code(401).send({ message: '用户名或密码错误' });
    }
    const token = app.jwt.sign({ adminId: admin.id, role: 'admin' }, { expiresIn: '12h' });
    return { token, admin: { id: admin.id, username: admin.username, name: admin.name } };
  });

  app.post('/wx/login', async (req, reply) => {
    const body = req.body as { code?: string };
    let openid = '';
    if (config.WX_APPID && config.WX_APPSECRET && body.code) {
      const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
      url.searchParams.set('appid', config.WX_APPID);
      url.searchParams.set('secret', config.WX_APPSECRET);
      url.searchParams.set('js_code', body.code);
      url.searchParams.set('grant_type', 'authorization_code');
      const res = await fetch(url);
      const data = await res.json() as any;
      if (!res.ok || !data.openid) return reply.code(401).send({ message: data.errmsg || '微信登录失败' });
      openid = data.openid;
    } else {
      // 本地联调专用；生产环境必须配置 WX_APPID / WX_APPSECRET。
      openid = 'dev_guest';
    }
    const user = await prisma.user.upsert({ where: { openid }, update: {}, create: { openid } });
    const token = app.jwt.sign({ userId: user.id, role: 'user' }, { expiresIn: '30d' });
    return { token, user };
  });
}
