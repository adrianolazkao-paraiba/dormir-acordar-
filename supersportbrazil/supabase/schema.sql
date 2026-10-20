-- SuperSportBrazil: tabela de assinaturas (rode no Supabase em SQL Editor > New query > Run)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending',          -- pending | authorized | paused | cancelled
  mp_preapproval_id text unique,                    -- id da assinatura no Mercado Pago
  paid_until timestamptz,                           -- próxima cobrança (acesso vale até aqui + 3 dias)
  trial_used boolean not null default false,        -- já usou os 7 dias grátis
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Cada pessoa só enxerga a própria assinatura; quem grava é o servidor (chave de serviço)
drop policy if exists "ver a propria assinatura" on public.subscriptions;
create policy "ver a propria assinatura" on public.subscriptions
  for select using (auth.uid() = user_id);
