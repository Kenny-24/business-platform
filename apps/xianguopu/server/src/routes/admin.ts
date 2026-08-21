import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import { canTransitionOrder, isKnownOrderStatus, shouldRestoreStock } from '../domain/order-status.js';

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function positiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    try { await req.jwtVerify(); } catch { return reply.code(401).send({ message: '登录已过期' }); }
    if (req.user.role !== 'admin') return reply.code(403).send({ message: '无权限' });
  });

  app.post('/upload', async (req, reply) => {
    const part = await req.file();
    if (!part) return reply.code(400).send({ message: '请选择图片' });
    const allowed = new Set(['image/jpeg','image/png','image/webp']);
    if (!allowed.has(part.mimetype)) return reply.code(400).send({ message: '仅支持 JPG/PNG/WebP' });
    const ext = part.mimetype === 'image/png' ? '.png' : part.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const dir = path.join(process.cwd(), 'public', 'uploads');
    await fs.promises.mkdir(dir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await pipeline(part.file, fs.createWriteStream(path.join(dir, filename)));
    return { url: `/static/uploads/${filename}` };
  });

  app.get('/settings/store', async () => {
    const row = await prisma.setting.findUnique({ where: { key: 'store' } });
    return row?.value || {};
  });

  app.put('/settings/store', async (req) => {
    const value = req.body as any;
    const row = await prisma.setting.upsert({ where: { key: 'store' }, update: { value }, create: { key: 'store', value } });
    return row.value;
  });

  app.get('/dashboard', async () => {
    const [products, onSale, orders, users, paidAgg, pending] = await Promise.all([
      prisma.product.count(), prisma.product.count({ where: { status: 'ON_SALE' } }), prisma.order.count(), prisma.user.count(),
      prisma.order.aggregate({ where: { status: { in: ['PAID','PREPARING','SHIPPED','COMPLETED'] } }, _sum: { totalAmount: true } }),
      prisma.order.count({ where: { status: { in: ['PAID','PREPARING'] } } }),
    ]);
    return { products, onSale, orders, users, gmV: Number(paidAgg._sum.totalAmount || 0), pending };
  });

  app.get('/categories', async () => prisma.category.findMany({ orderBy: [{ sort: 'desc' }, { id: 'asc' }] }));
  app.post('/categories', async (req) => prisma.category.create({ data: req.body as any }));
  app.put('/categories/:id', async (req) => prisma.category.update({ where: { id: Number((req.params as any).id) }, data: req.body as any }));
  app.delete('/categories/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount) return reply.code(409).send({ message: `该分类下仍有 ${productCount} 个商品，请先调整商品分类` });
    await prisma.category.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/products', async (req) => {
    const q = req.query as { keyword?: string; status?: string; page?: string; pageSize?: string };
    const page = positiveInt(q.page, 1), pageSize = positiveInt(q.pageSize, 20, 100);
    const where: any = {};
    if (q.keyword) where.OR = [{ name: { contains:q.keyword, mode:'insensitive' } }, { origin: { contains:q.keyword, mode:'insensitive' } }];
    if (q.status) where.status = q.status;
    const [items,total] = await Promise.all([
      prisma.product.findMany({ where, include:{ category:true, skus:{ where:{enabled:true}, orderBy:{ sort:'desc' } } }, orderBy:[{sort:'desc'},{id:'desc'}], skip:(page-1)*pageSize, take:pageSize }),
      prisma.product.count({ where })
    ]);
    return { items,total,page,pageSize };
  });

  app.post('/products', async (req) => {
    const b = req.body as any; const { skus=[], ...product } = b;
    return prisma.product.create({ data: { ...product, skus: { create: skus } }, include: { skus:true, category:true } });
  });

  app.put('/products/:id', async (req, reply) => {
    const id=Number((req.params as any).id); const b=req.body as any; const { skus=[], ...product }=b;
    if (!Array.isArray(skus) || !skus.length) return reply.code(400).send({ message: '至少保留一个 SKU' });
    return prisma.$transaction(async tx => {
      await tx.product.update({ where:{id}, data:product });
      const keepIds = skus.filter((x:any)=>x.id).map((x:any)=>Number(x.id));
      // 旧 SKU 可能仍被未完成订单引用。停用而不物理删除，才能在取消订单时可靠回补库存。
      if (keepIds.length) await tx.sku.updateMany({ where:{ productId:id, id:{ notIn:keepIds } }, data:{enabled:false} });
      else await tx.sku.updateMany({ where:{ productId:id }, data:{enabled:false} });
      for (const raw of skus) {
        const { id:skuId, ...skuData } = raw;
        if (skuId) {
          const owned = await tx.sku.findFirst({ where:{ id:Number(skuId), productId:id }, select:{id:true} });
          if (!owned) throw new Error('SKU 不属于当前商品');
          await tx.sku.update({ where:{id:Number(skuId)}, data:skuData });
        } else {
          await tx.sku.create({ data:{ ...skuData, productId:id } });
        }
      }
      return tx.product.findUnique({ where:{id}, include:{skus:{where:{enabled:true},orderBy:{sort:'desc'}},category:true} });
    });
  });

  app.delete('/products/:id', async (req, reply) => {
    const id = Number((req.params as any).id);
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) return reply.code(404).send({ message: '商品不存在' });
    await prisma.$transaction([
      prisma.product.update({ where: { id }, data: { status: 'OFF_SALE', featured: false } }),
      prisma.sku.updateMany({ where: { productId: id }, data: { enabled: false } }),
    ]);
    return { ok: true, archived: true };
  });

  app.get('/orders', async (req) => {
    const q=req.query as { status?: string; keyword?: string; page?: string; pageSize?: string };
    const page=positiveInt(q.page,1), pageSize=positiveInt(q.pageSize,20,100); const where:any={};
    if(q.status) where.status=q.status;
    if(q.keyword) where.OR=[{orderNo:{contains:q.keyword,mode:'insensitive'}},{receiver:{contains:q.keyword,mode:'insensitive'}},{phone:{contains:q.keyword}}];
    const [items,total]=await Promise.all([prisma.order.findMany({where,include:{items:true},orderBy:{id:'desc'},skip:(page-1)*pageSize,take:pageSize}),prisma.order.count({where})]);
    return {items,total,page,pageSize};
  });

  app.put('/orders/:id/status', async (req, reply) => {
    const id = Number((req.params as any).id);
    const b = req.body as { status?: string; trackingNo?: string; logisticsName?: string };
    const nextStatus = String(b.status || '');
    if (!isKnownOrderStatus(nextStatus)) return reply.code(400).send({ message: '订单状态无效' });

    return prisma.$transaction(async tx => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw httpError(404, '订单不存在');

      if (!canTransitionOrder(current.status, nextStatus)) {
        throw httpError(409, `订单不能从“${current.status}”变更为“${nextStatus}”`);
      }

      const logisticsName = b.logisticsName === undefined ? current.logisticsName : String(b.logisticsName || '').trim();
      const trackingNo = b.trackingNo === undefined ? current.trackingNo : String(b.trackingNo || '').trim();
      if (nextStatus === 'SHIPPED' && (!logisticsName || !trackingNo)) {
        throw httpError(400, '标记发货前请填写物流公司和物流单号');
      }

      if (shouldRestoreStock(current.status, nextStatus)) {
        for (const item of current.items) {
          await tx.sku.updateMany({ where: { id: item.skuId }, data: { stock: { increment: item.quantity } } });
        }
      }

      const data: any = { status: nextStatus, logisticsName, trackingNo };
      if (nextStatus === 'PAID' && !current.paidAt) data.paidAt = new Date();
      if (nextStatus === 'SHIPPED' && !current.shippedAt) data.shippedAt = new Date();
      if (nextStatus === 'COMPLETED' && !current.completedAt) data.completedAt = new Date();
      return tx.order.update({ where: { id }, data });
    });
  });
}
