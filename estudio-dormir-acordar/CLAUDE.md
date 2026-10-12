# Estúdio Dormir & Acordar — guia para o Claude Code

App web (HTML, CSS e JavaScript puro, sem build) que transforma fotos e vídeos de pijamas da marca
**Dormir & Acordar** em posts prontos para Instagram, Reels/Stories, TikTok, TikTok Shop, Pinterest
e marketplaces (Shopee, Mercado Livre). O dono é o Adriano, fala português do Brasil; responda e
escreva textos de interface em português do Brasil.

## Como rodar

- `npm start` → abre em http://localhost:5173 (servidor simples em `server.mjs`, sem dependências).
- `npm test` → testes de ponta a ponta com Playwright (primeira vez: `npm install` e `npx playwright install chromium`).
- O teste de recorte só roda se existir `tests/fixtures/modelo.jpg` (foto de modelo; não vai para o git).

Sempre rode `npm test` depois de mudar algo e antes de dizer que terminou.

## Regra do dono para toda entrega (obrigatória)

Antes de entregar qualquer tarefa ou link para o Adriano:

1. **Revise o código 3 vezes**, e a cada revisão melhore o que achar (bugs, compatibilidade com
   iPhone/iPad/Safari, acabamento visual, mensagens para o usuário).
2. **Teste cada componente na prática**, não só os testes automáticos: use o estúdio como uma pessoa
   usaria (enviar foto real de modelo, recorte, cenários, marcas, textos, baixar arte, .zip, vídeo,
   "Já feitos"), em tela de computador, iPhone (390×844) e iPad (820×1180, em pé e deitado), e
   **olhe as imagens geradas** para conferir o resultado.
3. Só depois disso entregue o acesso, dizendo o que foi testado e o que não deu para testar
   (por exemplo, Safari de verdade no iPhone).

## Estrutura

- `index.html` — marcação da página (painel de etapas, prévias, barra de baixar, "Já feitos").
- `css/estudio.css` — estilos. Cores em variáveis no `:root`, com modo escuro.
- `js/` — scripts clássicos carregados em ordem pelo `index.html` (compartilham variáveis globais;
  a ordem importa). Cada arquivo é uma parte:
  - `00-plataforma.js` — no claude.ai a página recebe `window.claude` (downloads, db, assets, sample).
    Rodando local, este arquivo cria uma versão equivalente: downloads diretos e "Já feitos" guardado
    no navegador (IndexedDB). Legendas (sample) ficam desligadas localmente.
  - `01-marca.js` cores e fontes da marca, logo · `02-formatos.js` medidas e regras de cada plataforma
  - `03-cenarios-lista.js` lista de cenários (suporta cenário por foto: campo `photo`, `fs` = altura onde começa o chão, `fx` = centro)
  - `04-estado.js` estado `S` e preferências salvas · `05-utilidades.js` funções de apoio
  - `06-cenarios-desenho.js` cenários desenhados no canvas e estrelas do logo
  - `07-exemplo.js` pijama ilustrado de exemplo · `08-recorte.js` recorte da modelo com ONNX (ISNet) no navegador
  - `09-composicao.js` plano da arte (espaço do texto, da marca e da modelo), monograma D&A, renderização de cada formato
  - `10-frente-costas.js` · `11-itens.js` · `12-interface.js` · `13-exportacao.js` (JPG/.zip)
  - `14-video.js` gravação de vídeo com MediaRecorder · `15-ja-feitos.js` histórico · `16-legendas.js` · `17-eventos.js` · `18-inicio.js`
- `model/` — modelo de recorte ISNet (pesos em 8 bits, cálculo em precisão total), dividido em 4 partes.
  Não troque por versão "quantizada dinâmica": ela deixava manchas no recorte.
- `vendor/` — onnxruntime-web 1.20.1 e JSZip 3.10.1 (cópias locais, funciona offline).
- `assets/logo.jpg` — logo oficial (céu azul-noite, horizonte em areia, PIJAMAS).

## Regras do produto (não quebrar)

- **Identidade:** azul-noite `#33356B`, areia `#F1E8D4`, dourado `#D2A967`; fontes Fraunces (títulos) e Inter (texto).
  Nunca preto ou branco puros na interface. O logo não deve ser redesenhado.
- **A modelo nunca fica embaixo do texto ou da marca.** `planArt()` reserva o espaço do texto e da marca;
  a modelo é encaixada no espaço livre. Cabeça e pés sempre inteiros.
- **Vertical 9:16:** texto, preço e marca fora das áreas cobertas pela interface do TikTok/Instagram
  (`SAFE_V`); os pés ficam acima da faixa de legenda e carrinho.
- **Fotos principais do TikTok Shop e dos marketplaces:** fundo branco, sem texto, sem logo, sem marca d'água.
- **Vídeo do TikTok Shop:** no máximo 15 s.
- **Cenário da marca:** igual ao logo (azul-noite liso, estrelas de 4 pontas e pontos, horizonte curvo em areia).
- O dono preferiu os **cenários desenhados** às fotos geradas por IA; não troque sem ele pedir.
- **Marcas disponíveis:** logo original, D&A com círculo, D&A sem círculo, marca d'água com e sem círculo, nenhuma.
  O "&" é reto e do mesmo tamanho das letras.
- Fotos e vídeos do usuário não saem do aparelho (recorte roda no navegador).

## Publicar de volta no claude.ai (opcional)

A versão publicada no claude.ai é um único HTML com os arquivos `model/`, `vendor/` e `assets/` ao lado.
Para montar: `npm run build:claude` → `dist/estudio-dormir-acordar.html` (junta CSS e JS na ordem do
`index.html`). Publique esse arquivo com `vendor/`, `model/` e `assets/logo.jpg` como arquivos de apoio,
e as capacidades `downloads`, `db`, `assets` e `sample` com `images: true` (as legendas mandam a foto
da peça para o Claude descrever).

Página publicada: https://claude.ai/artifact/7wV7DsHWFynfAvAZMLhFZw (atualize esta mesma, não crie outra).
