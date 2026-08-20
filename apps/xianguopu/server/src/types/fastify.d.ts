import '@fastify/jwt';
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { adminId?: number; userId?: number; role: 'admin' | 'user' };
    user: { adminId?: number; userId?: number; role: 'admin' | 'user' };
  }
}
