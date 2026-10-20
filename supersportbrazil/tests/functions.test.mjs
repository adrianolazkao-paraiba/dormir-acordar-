// Testes das rotas do servidor com Supabase e Mercado Pago simulados (node --test)
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { onRequestGet as status } from '../functions/api/status.js';
import { onRequestPost as assinar } from '../functions/api/assinar.js';
import { onRequestPost as webhook } from '../functions/api/mp-webhook.js';
import { onRequest as guard } from '../functions/app/_middleware.js';
import { isActive } from '../lib/server.js';

const env = { SUPABASE_URL: 'https://sb.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', MP_ACCESS_TOKEN: 'mp', MP_WEBHOOK_SECRET: 'segredo', PRICE_BRL: '39.90', SITE_URL: 'https://ssb.test' };
let subs = {}; let preapprovals = {}; let lastPre = null;
const USER = { id: 'u1', email: 'a@b.com' };
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url); const auth = (opts.headers || {}).Authorization;
  const res = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (u.host === 'sb.test' && u.pathname === '/auth/v1/user') return auth === 'Bearer good' ? res(USER) : res({}, 401);
  if (u.host === 'sb.test' && u.pathname === '/rest/v1/subscriptions') {
    if ((opts.method || 'GET') === 'GET') {
      const uid = u.searchParams.get('user_id'), pid = u.searchParams.get('mp_preapproval_id');
      const rows = Object.values(subs).filter(r => (uid && 'eq.' + r.user_id === uid) || (pid && 'eq.' + r.mp_preapproval_id === pid));
      return res(rows);
    }
    const row = JSON.parse(opts.body); subs[row.user_id] = { ...(subs[row.user_id] || {}), ...row }; return res([subs[row.user_id]], 201);
  }
  if (u.host === 'api.mercadopago.com') {
    if (u.pathname === '/preapproval' && opts.method === 'POST') { lastPre = JSON.parse(opts.body); const p = { id: 'pre1', init_point: 'https://mp.test/checkout/pre1', ...lastPre }; preapprovals.pre1 = p; return res(p, 201); }
    const m = u.pathname.match(/^\/preapproval\/(.+)$/); if (m) return res(preapprovals[m[1]]);
    const a = u.pathname.match(/^\/authorized_payments\/(.+)$/); if (a) return res({ id: a[1], preapproval_id: 'pre1' });
  }
  return res({ error: 'nao simulado ' + url }, 500);
};
const req = (path, { method = 'GET', token, body, headers = {} } = {}) => new Request('https://ssb.test' + path, { method, body: body && JSON.stringify(body), headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers } });
const sign = (id, reqId, ts) => crypto.createHmac('sha256', env.MP_WEBHOOK_SECRET).update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');

test('status sem login = 401', async () => { assert.equal((await status({ request: req('/api/status'), env })).status, 401); });

test('fluxo completo: assinar -> webhook autoriza -> acesso liberado -> cancelado bloqueia', async () => {
  subs = {}; preapprovals = {};
  let r = await (await status({ request: req('/api/status', { token: 'good' }), env })).json();
  assert.equal(r.active, false); assert.equal(r.trialAvailable, true);
  // assinar
  r = await (await assinar({ request: req('/api/assinar', { method: 'POST', token: 'good', body: {} }), env })).json();
  assert.equal(r.url, 'https://mp.test/checkout/pre1');
  assert.equal(lastPre.external_reference, 'u1'); assert.equal(lastPre.auto_recurring.transaction_amount, 39.9);
  assert.deepEqual(lastPre.auto_recurring.free_trial, { frequency: 7, frequency_type: 'days' });
  assert.equal(subs.u1.status, 'pending');
  // middleware bloqueia enquanto pendente
  const next = async () => new Response('<html>cortador</html>');
  assert.equal((await guard({ request: req('/app/cortador', { token: 'good' }), env, next })).status, 402);
  // webhook com assinatura errada é recusado
  preapprovals.pre1.status = 'authorized'; preapprovals.pre1.next_payment_date = new Date(Date.now() + 7 * 864e5).toISOString();
  let w = await webhook({ request: req('/api/mp-webhook', { method: 'POST', body: { type: 'subscription_preapproval', data: { id: 'pre1' } }, headers: { 'x-signature': 'ts=1,v1=errado', 'x-request-id': 'r1' } }), env });
  assert.equal(w.status, 401);
  // webhook válido autoriza
  w = await webhook({ request: req('/api/mp-webhook', { method: 'POST', body: { type: 'subscription_preapproval', data: { id: 'pre1' } }, headers: { 'x-signature': 'ts=123,v1=' + sign('pre1', 'r2', '123'), 'x-request-id': 'r2' } }), env });
  assert.equal(w.status, 200); assert.equal(subs.u1.status, 'authorized'); assert.equal(subs.u1.trial_used, true);
  r = await (await status({ request: req('/api/status', { token: 'good' }), env })).json();
  assert.equal(r.active, true);
  const ok = await guard({ request: req('/app/cortador', { token: 'good' }), env, next });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.match(await ok.text(), /cortador/);
  // sem login o cortador não é entregue
  assert.equal((await guard({ request: req('/app/cortador'), env, next })).status, 401);
  // aviso de pagamento mensal também atualiza
  w = await webhook({ request: req('/api/mp-webhook', { method: 'POST', body: { type: 'subscription_authorized_payment', data: { id: 'pay9' } }, headers: { 'x-signature': 'ts=5,v1=' + sign('pay9', 'r3', '5'), 'x-request-id': 'r3' } }), env });
  assert.equal(w.status, 200);
  // cancelado bloqueia
  preapprovals.pre1.status = 'cancelled';
  await webhook({ request: req('/api/mp-webhook', { method: 'POST', body: { type: 'subscription_preapproval', data: { id: 'pre1' } }, headers: { 'x-signature': 'ts=9,v1=' + sign('pre1', 'r4', '9'), 'x-request-id': 'r4' } }), env });
  assert.equal(subs.u1.status, 'cancelled');
  assert.equal((await guard({ request: req('/app/cortador', { token: 'good' }), env, next })).status, 402);
  // nova assinatura não ganha os 7 dias grátis de novo
  await assinar({ request: req('/api/assinar', { method: 'POST', token: 'good', body: {} }), env });
  assert.equal(lastPre.auto_recurring.free_trial, undefined);
});

test('acesso vale até a data paga + 3 dias de tolerância', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  assert.equal(isActive({ status: 'authorized', paid_until: '2026-10-18T00:00:00Z' }, now), true);
  assert.equal(isActive({ status: 'authorized', paid_until: '2026-10-16T00:00:00Z' }, now), false);
  assert.equal(isActive({ status: 'paused', paid_until: '2026-11-18T00:00:00Z' }, now), false);
});

test('outras rotas de /app passam direto pelo middleware', async () => {
  const r = await guard({ request: req('/app/'), env, next: async () => new Response('shell') });
  assert.equal(await r.text(), 'shell');
});
