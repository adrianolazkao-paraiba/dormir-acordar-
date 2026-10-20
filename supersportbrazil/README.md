# SuperSportBrazil

Site de assinatura mensal do **Cortador de Lances**: o assinante abre o vídeo do jogo no navegador, marca os lances, desenha por cima (círculo, seta, texto, conector, campo tático) e baixa os cortes. O vídeo nunca sai do computador do usuário.

## Como o site é montado

| Parte | Serviço | Custo |
|---|---|---|
| Páginas e servidor | Cloudflare Pages (+ Functions) | grátis |
| Login e banco de dados | Supabase | grátis no início |
| Cobrança mensal | Mercado Pago Assinaturas | taxa por venda |
| Domínio | registro.br | ~R$ 40/ano |

```
public/            páginas do site
  index.html       página de vendas
  entrar.html      entrar / criar conta
  conta.html       situação da assinatura, assinar, cancelar
  app/index.html   abre o Cortador (só para assinantes)
  app/cortador.html  o Cortador (entregue pelo servidor só com assinatura ativa)
  termos.html, privacidade.html   RASCUNHOS: revisar com advogado
functions/         servidor (Cloudflare Pages Functions)
  api/config.js       dados públicos (endereço do Supabase, preço)
  api/status.js       situação da assinatura de quem está logado
  api/assinar.js      cria a assinatura no Mercado Pago e devolve o link de pagamento
  api/mp-webhook.js   recebe os avisos do Mercado Pago e atualiza a assinatura
  app/_middleware.js  bloqueia o Cortador para quem não paga
lib/server.js      funções compartilhadas do servidor
supabase/schema.sql  tabela de assinaturas
tests/             testes do servidor (npm test)
```

## Regras da assinatura

- 7 dias grátis, só na primeira assinatura de cada conta.
- Depois, cobrança mensal automática (valor em `PRICE_BRL`, padrão R$ 39,90).
- O acesso vale enquanto o Mercado Pago informar a assinatura como **ativa** (`authorized`) e até a data da próxima cobrança + 3 dias de tolerância.
- Cancelou ou parou de pagar: o Cortador deixa de abrir sozinho.

## Passo a passo para colocar no ar

### 1. Supabase (login e banco)
1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Em **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://supersportbrazil.com.br`).
4. Em **Project Settings → API**, anote: **Project URL**, chave **anon public** e chave **service_role** (esta é secreta).

### 2. Mercado Pago
1. Em https://www.mercadopago.com.br/developers/panel, crie uma **aplicação** (produto: Assinaturas).
2. Anote o **Access Token de produção** (secreto). Para testar antes, use as credenciais de teste.
3. Em **Webhooks**, cadastre a URL `https://SEU-DOMINIO/api/mp-webhook`, marque os eventos de **Assinaturas** (planos e assinaturas, pagamentos autorizados) e anote a **assinatura secreta**.

### 3. Cloudflare Pages
1. Crie uma conta em https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** e escolha este repositório.
2. Configuração de build: *Framework*: nenhum; *Build command*: vazio; *Output directory*: `public`.
3. Em **Settings → Environment variables** (Production), cadastre:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | Project URL do Supabase |
| `SUPABASE_ANON_KEY` | chave anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (**secreta**, marque *Encrypt*) |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (**secreto**, *Encrypt*) |
| `MP_WEBHOOK_SECRET` | assinatura secreta do webhook (**secreta**, *Encrypt*) |
| `PRICE_BRL` | `39.90` (ou o preço que quiser) |
| `SITE_URL` | `https://supersportbrazil.com.br` |

4. Em **Custom domains**, ligue o domínio comprado no registro.br.

> Nunca coloque as chaves secretas no código nem mande em conversas. Elas ficam só no painel da Cloudflare.

### 4. Testar
1. Crie uma conta no site, clique em **Assinar** e pague com um cartão de teste (credenciais de teste do Mercado Pago).
2. Volte para **Minha conta**: em alguns segundos aparece **Assinatura ativa** e o botão **Abrir o Cortador**.
3. Cancele no Mercado Pago e confira que o acesso é bloqueado.

## Desenvolvimento

```bash
npm test                      # testes do servidor
npx wrangler@3 pages dev public   # roda o site localmente em http://localhost:8788
```

O `public/app/cortador.html` é o mesmo Cortador publicado como artefato, com as bibliotecas `mp4box.js` (BSD-3) e `mp4-muxer` (MIT) embutidas para os cortes rápidos.
