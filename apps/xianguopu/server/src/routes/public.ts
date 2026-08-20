import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function publicRoutes(app: FastifyInstance) {
  app.get('/settings/store', async () => {
    const s = await prisma.setting.findUnique({ where: { key: 'store' } });
    return s?.value || { storeName: '鲜果铺', slogan: '把新鲜送到家', baseFreight: 8, freeShippingThreshold: 99, nationwideEnabled: true };
  });

  app.get('/categories', async () => {
    return prisma.category.findMany({ where: { enabled: true }, orderBy: [{ sort: 'desc' }, { id: 'asc' }] });
  });

  app.get('/products', async (req) => {
    const q = req.query as { categoryId?: string; keyword?: string; featured?: string; page?: string; pageSize?: string };
    const page = Math.max(Number(q.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(q.pageSize || 20), 1), 50);
    const where: any = { status: 'ON_SALE' };
    if (q.categoryId) where.categoryId = Number(q.categoryId);
    if (q.featured === '1') where.featured = true;
    if (q.keyword) {
      where.OR = [
        { name: { contains: q.keyword, mode: 'insensitive' } },
        { origin: { contains: q.keyword, mode: 'insensitive' } },
        { variety: { contains: q.keyword, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { skus: { where: { enabled: true }, orderBy: [{ sort: 'desc' }, { id: 'asc' }] }, category: true },
        orderBy: [{ sort: 'desc' }, { featured: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/products/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const product = await prisma.product.findFirst({
      where: { id: Number(id), status: 'ON_SALE' },
      include: { skus: { where: { enabled: true }, orderBy: [{ sort: 'desc' }, { id: 'asc' }] }, category: true },
    });
    if (!product) return reply.code(404).send({ message: '商品不存在或已下架' });
    return product;
  });
}
