// Funções de apoio usadas pelas rotas do servidor (Cloudflare Pages Functions).
// Variáveis de ambiente (configuradas no painel da Cloudflare, nunca no código):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, PRICE_BRL, SITE_URL
export const DAY = 86400000;
export const GRACE_DAYS = 3; // tolerância depois da data de cobrança antes de bloquear

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export const price = env => Number(env.PRICE_BRL || 39.9);

// Confere o token de login do Supabase e devolve o usuário (ou null)
export async function getUser(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const r = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

// Acesso ao banco com a chave de serviço (só no servidor)
export async function db(env, path, opts = {}) {
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + path, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error('Banco de dados: ' + r.status + ' ' + (await r.text()));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export async function getSub(env, userId) {
  const rows = await db(env, 'subscriptions?user_id=eq.' + encodeURIComponent(userId) + '&select=*');
  return (rows && rows[0]) || null;
}

export async function saveSub(env, row) {
  const rows = await db(env, 'subscriptions?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
  return rows && rows[0];
}

// Assinatura vale enquanto o Mercado Pago diz "authorized" e a data paga (+ tolerância) não passou
export function isActive(sub, now = Date.now()) {
  if (!sub || sub.status !== 'authorized') return false;
  const until = sub.paid_until ? Date.parse(sub.paid_until) : 0;
  return until + GRACE_DAYS * DAY > now;
}

export async function mp(env, path, opts = {}) {
  const r = await fetch('https://api.mercadopago.com' + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('Mercado Pago: ' + (body.message || r.status)), { status: r.status, body });
  return body;
}

// Valida a assinatura (x-signature) das notificações do Mercado Pago
export async function validMpSignature(request, env, dataId) {
  if (!env.MP_WEBHOOK_SECRET) return true; // sem segredo configurado, confia na consulta à API
  const sig = request.headers.get('x-signature') || '';
  const reqId = request.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(sig.split(',').map(p => p.trim().split('=')));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${reqId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.MP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === parts.v1;
}
