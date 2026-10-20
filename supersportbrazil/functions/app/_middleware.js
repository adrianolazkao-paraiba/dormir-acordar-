import { getUser, getSub, isActive } from '../../lib/server.js';

// Só entrega o Cortador para quem está logado e com assinatura ativa
export async function onRequest(ctx) {
  const path = new URL(ctx.request.url).pathname;
  if (!path.startsWith('/app/cortador')) return ctx.next();
  const user = await getUser(ctx.request, ctx.env);
  if (!user) return new Response('Entre na sua conta.', { status: 401 });
  const sub = await getSub(ctx.env, user.id);
  if (!isActive(sub)) return new Response('Assinatura inativa.', { status: 402 });
  const res = await ctx.next();
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, headers });
}
