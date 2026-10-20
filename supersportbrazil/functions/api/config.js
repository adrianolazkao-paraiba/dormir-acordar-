import { json, price } from '../../lib/server.js';

// Dados públicos que as páginas precisam (a chave "anon" do Supabase é pública por natureza)
export async function onRequestGet({ env }) {
  return json({ supabaseUrl: env.SUPABASE_URL || '', supabaseAnonKey: env.SUPABASE_ANON_KEY || '', price: price(env) });
}
