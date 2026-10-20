import { json, getUser, getSub, saveSub, isActive, mp, price } from '../../lib/server.js';

// Cria a assinatura mensal no Mercado Pago e devolve o link para o cliente pagar
export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta.' }, 401);
  const sub = await getSub(env, user.id);
  if (isActive(sub)) return json({ error: 'Sua assinatura já está ativa.' }, 409);
  const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const auto = { frequency: 1, frequency_type: 'months', transaction_amount: price(env), currency_id: 'BRL' };
  if (!(sub && sub.trial_used)) auto.free_trial = { frequency: 7, frequency_type: 'days' }; // 7 dias grátis só na primeira vez
  try {
    const pre = await mp(env, '/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'SuperSportBrazil – assinatura mensal',
        external_reference: user.id,
        payer_email: user.email,
        back_url: site + '/conta.html?pago=1',
        auto_recurring: auto,
        status: 'pending',
      }),
    });
    await saveSub(env, { user_id: user.id, status: 'pending', mp_preapproval_id: pre.id, trial_used: !!(sub && sub.trial_used) });
    return json({ url: pre.init_point });
  } catch (e) {
    return json({ error: 'Não foi possível abrir o pagamento agora. ' + e.message }, 502);
  }
}
