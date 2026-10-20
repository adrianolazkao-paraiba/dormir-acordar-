import { json, getUser, getSub, isActive, price } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta.' }, 401);
  const sub = await getSub(env, user.id);
  return json({
    active: isActive(sub),
    status: sub ? sub.status : null,
    nextPaymentDate: sub ? sub.paid_until : null,
    trialAvailable: !(sub && sub.trial_used),
    price: price(env),
  });
}
