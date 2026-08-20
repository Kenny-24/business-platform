import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

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
  app.delete('/categories/:id', async (req) => { await prisma.category.delete({ where: { id: Number((req.params as any).id) } }); return { ok: true }; });

  app.get('/products', async (req) => {
    const q = req.query as { keyword?: string; status?: string; page?: string; pageSize?: string };
    const page = Math.max(Number(q.page || 1),1), pageSize = Math.min(Number(q.pageSize || 20),100);
    const where: any = {};
    if (q.keyword) where.OR = [{ name: { contains:q.keyword, mode:'insensitive' } }, { origin: { contains:q.keyword, mode:'insensitive' } }];
    if (q.status) where.status = q.status;
    const [items,total] = await Promise.all([
      prisma.product.findMany({ where, include:{ category:true, skus:{ orderBy:{ sort:'desc' } } }, orderBy:[{sort:'desc'},{id:'desc'}], skip:(page-1)*pageSize, take:pageSize }),
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
      if (keepIds.length) await tx.sku.deleteMany({ where:{ productId:id, id:{ notIn:keepIds } } });
      else await tx.sku.deleteMany({ where:{ productId:id } });
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
      return tx.product.findUnique({ where:{id}, include:{skus:{orderBy:{sort:'desc'}},category:true} });
    });
  });

  app.delete('/products/:id', async (req) => { await prisma.product.delete({ where:{id:Number((req.params as any).id)} }); return {ok:true}; });

  app.get('/orders', async (req) => {
    const q=req.query as { status?: string; keyword?: string; page?: string; pageSize?: string };
    const page=Math.max(Number(q.page||1),1), pageSize=Math.min(Number(q.pageSize||20),100); const where:any={};
    if(q.status) where.status=q.status;
    if(q.keyword) where.OR=[{orderNo:{contains:q.keyword,mode:'insensitive'}},{receiver:{contains:q.keyword,mode:'insensitive'}},{phone:{contains:q.keyword}}];
    const [items,total]=await Promise.all([prisma.order.findMany({where,include:{items:true},orderBy:{id:'desc'},skip:(page-1)*pageSize,take:pageSize}),prisma.order.count({where})]);
    return {items,total,page,pageSize};
  });

  app.put('/orders/:id/status', async (req) => {
    const id=Number((req.params as any).id); const b=req.body as {status:any; trackingNo?:string; logisticsName?:string};
    const data:any={status:b.status};
    if(b.status==='SHIPPED') data.shippedAt=new Date();
    if(b.status==='COMPLETED') data.completedAt=new Date();
    if(b.trackingNo!==undefined) data.trackingNo=b.trackingNo;
    if(b.logisticsName!==undefined) data.logisticsName=b.logisticsName;
    return prisma.order.update({where:{id},data});
  });
}
