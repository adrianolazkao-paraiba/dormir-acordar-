import { json, db, saveSub, mp, validMpSignature } from '../../lib/server.js';

// Recebe os avisos do Mercado Pago (assinatura criada, paga, pausada, cancelada)
// e atualiza a situação do assinante. Sempre confirma os dados consultando a API do Mercado Pago.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '';
  const dataId = (body.data && body.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (!dataId) return json({ ok: true, ignored: 'sem id' });
  if (!(await validMpSignature(request, env, dataId))) return json({ error: 'assinatura inválida' }, 401);

  let preId = null;
  if (type.includes('preapproval') && !type.includes('authorized_payment')) preId = dataId;
  else if (type.includes('authorized_payment')) {
    const pay = await mp(env, '/authorized_payments/' + encodeURIComponent(dataId));
    preId = pay.preapproval_id;
  } else return json({ ok: true, ignored: type });
  if (!preId) return json({ ok: true, ignored: 'sem assinatura' });

  const pre = await mp(env, '/preapproval/' + encodeURIComponent(preId));
  let userId = pre.external_reference;
  if (!userId) {
    const rows = await db(env, 'subscriptions?mp_preapproval_id=eq.' + encodeURIComponent(pre.id) + '&select=user_id');
    userId = rows && rows[0] && rows[0].user_id;
  }
  if (!userId) return json({ ok: true, ignored: 'assinante não encontrado' });

  const row = { user_id: userId, status: pre.status, mp_preapproval_id: pre.id, paid_until: pre.next_payment_date || null };
  if (pre.status === 'authorized') row.trial_used = true;
  await saveSub(env, row);
  return json({ ok: true, status: pre.status });
}
