import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { prisma } from '../lib/prisma.js';
import { createOrderNo } from '../lib/order.js';
import { config } from '../config.js';

function validAvatarUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^\/static\/uploads\/avatars\//.test(value);
}

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    try { await req.jwtVerify(); } catch { return reply.code(401).send({ message: '请先登录' }); }
    if (req.user.role !== 'user') return reply.code(403).send({ message: '无权限' });
  });

  app.get('/me', async (req) => prisma.user.findUnique({ where: { id: req.user.userId! } }));

  app.put('/me', async (req, reply) => {
    const body = req.body as { nickname?: string; avatarUrl?: string };
    const data: { nickname?: string; avatarUrl?: string } = {};
    if (body.nickname !== undefined) {
      const nickname = String(body.nickname || '').trim();
      if (!nickname || nickname.length > 20) return reply.code(400).send({ message: '昵称请输入 1–20 个字符' });
      data.nickname = nickname;
    }
    if (body.avatarUrl !== undefined) {
      const avatarUrl = String(body.avatarUrl || '').trim();
      if (!avatarUrl || avatarUrl.length > 800 || !validAvatarUrl(avatarUrl)) return reply.code(400).send({ message: '头像地址无效，请重新选择' });
      data.avatarUrl = avatarUrl;
    }
    if (!Object.keys(data).length) return reply.code(400).send({ message: '没有可保存的资料' });
    return prisma.user.update({ where: { id: req.user.userId! }, data });
  });

  app.post('/me/avatar', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ message: '请选择头像图片' });
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(part.mimetype)) return reply.code(400).send({ message: '头像仅支持 JPG、PNG 或 WebP' });
    const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const directory = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await fs.promises.mkdir(directory, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await pipeline(part.file, fs.createWriteStream(path.join(directory, filename)));
    return { url: `/static/uploads/avatars/${filename}` };
  });

  app.get('/addresses', async (req) => prisma.address.findMany({ where: { userId: req.user.userId! }, orderBy: [{ isDefault: 'desc' }, { id: 'desc' }] }));

  app.post('/addresses', async (req) => {
    const b = req.body as any;
    const userId = req.user.userId!;
    if (b.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return prisma.address.create({ data: { userId, receiver: b.receiver, phone: b.phone, province: b.province, city: b.city, district: b.district, detail: b.detail, isDefault: !!b.isDefault } });
  });

  app.put('/addresses/:id', async (req, reply) => {
    const b = req.body as any; const id = Number((req.params as any).id); const userId = req.user.userId!;
    const own = await prisma.address.findFirst({ where: { id, userId } });
    if (!own) return reply.code(404).send({ message: '地址不存在' });
    if (b.isDefault) await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return prisma.address.update({ where: { id }, data: { receiver: b.receiver, phone: b.phone, province: b.province, city: b.city, district: b.district, detail: b.detail, isDefault: !!b.isDefault } });
  });

  app.delete('/addresses/:id', async (req) => {
    const id = Number((req.params as any).id);
    await prisma.address.deleteMany({ where: { id, userId: req.user.userId! } });
    return { ok: true };
  });

  app.post('/orders', async (req, reply) => {
    const b = req.body as {
      addressId: number;
      items: Array<{ skuId: number; quantity: number }>;
      remark?: string;
      isGift?: boolean;
      deliverySlot?: string | null;
    };
    if (!b.items?.length) return reply.code(400).send({ message: '购物车为空' });
    if (b.isGift !== undefined && typeof b.isGift !== 'boolean') {
      return reply.code(400).send({ message: '礼赠服务信息无效' });
    }

    const remark = String(b.remark || '').trim();
    const deliverySlot = String(b.deliverySlot || '').trim();
    if (remark.length > 80) return reply.code(400).send({ message: '订单备注最多填写 80 个字符' });
    if (deliverySlot && !/^\d{2}:\d{2}[–-]\d{2}:\d{2}$/.test(deliverySlot)) {
      return reply.code(400).send({ message: '配送时段格式无效，请重新选择' });
    }

    const address = await prisma.address.findFirst({ where: { id: b.addressId, userId: req.user.userId! } });
    if (!address) return reply.code(400).send({ message: '收货地址无效' });

    const merged = new Map<number, number>();
    for (const raw of b.items) {
      const skuId = Number(raw.skuId), quantity = Number(raw.quantity);
      if (!Number.isInteger(skuId) || skuId <= 0 || !Number.isFinite(quantity) || quantity <= 0) return reply.code(400).send({ message: '商品数量无效' });
      merged.set(skuId, (merged.get(skuId) || 0) + quantity);
    }
    const normalizedItems = [...merged.entries()].map(([skuId, quantity]) => ({ skuId, quantity }));
    const skuIds = normalizedItems.map(item => item.skuId);
    const skus = await prisma.sku.findMany({ where: { id: { in: skuIds }, enabled: true }, include: { product: true } });
    const skuMap = new Map(skus.map(sku => [sku.id, sku]));
    if (skuMap.size !== skuIds.length) return reply.code(400).send({ message: '存在无效或已停用规格' });

    let subtotalCents = 0;
    const rows: any[] = [];
    for (const item of normalizedItems) {
      const sku = skuMap.get(item.skuId)!;
      if (sku.product.status !== 'ON_SALE') return reply.code(400).send({ message: `${sku.product.name} 已下架` });
      const quantity = item.quantity;
      const stock = Number(sku.stock), min = Number(sku.minPurchase), step = Number(sku.step);
      const stepCount = (quantity - min) / step;
      const stepValid = quantity >= min && step > 0 && Math.abs(stepCount - Math.round(stepCount)) < 1e-7;
      if (!stepValid) return reply.code(400).send({ message: `${sku.product.name} 购买数量不符合起购量/步长规则` });
      if (quantity > stock) return reply.code(400).send({ message: `${sku.product.name} 库存不足` });
      const priceCents = Math.round(Number(sku.price) * 100);
      const amountCents = Math.round(priceCents * quantity);
      subtotalCents += amountCents;
      rows.push({
        productId: sku.productId,
        skuId: sku.id,
        name: sku.product.name,
        imageUrl: sku.product.imageUrl,
        specText: sku.specText,
        unitName: sku.unitName,
        price: priceCents / 100,
        quantity,
        amount: amountCents / 100
      });
    }

    const settingRow = await prisma.setting.findUnique({ where: { key: 'store' } });
    const setting = (settingRow?.value || {}) as any;
    const baseFreightCents = Math.max(0, Math.round(Number(setting.baseFreight ?? 8) * 100));
    const freeThresholdCents = Math.max(0, Math.round(Number(setting.freeShippingThreshold ?? 99) * 100));
    const freightCents = subtotalCents >= freeThresholdCents ? 0 : baseFreightCents;
    const subtotal = subtotalCents / 100, freight = freightCents / 100, totalAmount = (subtotalCents + freightCents) / 100;

    const order = await prisma.$transaction(async tx => {
      for (const item of normalizedItems) {
        const sku = skuMap.get(item.skuId)!;
        const result = await tx.sku.updateMany({ where: { id: sku.id, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (result.count !== 1) throw new Error(`${sku.product.name} 库存刚刚发生变化，请重新下单`);
      }
      return tx.order.create({
        data: {
          orderNo: createOrderNo(),
          userId: req.user.userId!,
          status: config.PAYMENT_MODE === 'mock' ? 'PAID' : 'PENDING_PAYMENT',
          receiver: address.receiver,
          phone: address.phone,
          fullAddress: `${address.province}${address.city}${address.district}${address.detail}`,
          remark: remark || null,
          isGift: Boolean(b.isGift),
          deliverySlot: deliverySlot || null,
          subtotal,
          freight,
          discount: 0,
          totalAmount,
          paidAt: config.PAYMENT_MODE === 'mock' ? new Date() : null,
          items: { create: rows }
        },
        include: { items: true }
      });
    });
    return { order, payment: config.PAYMENT_MODE === 'mock' ? { mode: 'mock', paid: true } : { mode: 'wechat', paid: false, message: '请接入商户微信支付 JSAPI 参数生成器' } };
  });

  app.get('/orders', async (req) => {
    const q = req.query as { status?: string };
    return prisma.order.findMany({ where: { userId: req.user.userId!, ...(q.status ? { status: q.status as any } : {}) }, include: { items: true }, orderBy: { id: 'desc' } });
  });

  app.get('/orders/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const order = await prisma.order.findFirst({ where: { id, userId: req.user.userId! }, include: { items: true } });
    if (!order) return reply.code(404).send({ message: '订单不存在' });
    return order;
  });
}
