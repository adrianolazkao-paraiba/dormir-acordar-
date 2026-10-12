# Estúdio Dormir & Acordar

Transforma fotos e vídeos dos pijamas em posts prontos, nas medidas certas, com a identidade da marca:

| Plataforma | Formato | Medida |
|---|---|---|
| Instagram | Feed e carrossel | 1080 × 1350 (4:5) |
| Reels · Stories · TikTok | Vertical tela cheia (foto e vídeo) | 1080 × 1920 (9:16) |
| TikTok Shop | Vídeo do produto (até 15 s) | 1080 × 1920 |
| TikTok Shop | Foto principal da vitrine (fundo branco) | 1080 × 1080 |
| TikTok Shop | Fotos 2 a 9 do anúncio | 1080 × 1080 |
| Pinterest | Pin padrão | 1000 × 1500 (2:3) |
| Shopee · Mercado Livre | Foto principal (fundo branco) | 1500 × 1500 |

Recursos: recorte da modelo no próprio navegador, 8 cenários + "Seu cenário", textos de venda,
6 opções de marca (logo, D&A, marca d'água), frente e costas lado a lado, vídeos com cartão final,
pacote .zip e histórico "Já feitos".

## Arquivos do recorte (pasta `model`)

O recorte da modelo usa 4 arquivos grandes (`isnet-w8.part0.dat.wasm` a `isnet-w8.part3.dat.wasm`, 47 MB no total)
que precisam ficar dentro da pasta `model/`. Se vieram separados, descompacte e coloque os 4 lá.
Sem eles o app funciona, mas não troca o fundo das fotos.

## Abrir no Mac com dois cliques

Clique duas vezes em **`Abrir Estudio.command`**. Na primeira vez o macOS pode bloquear:
clique com o botão direito no arquivo → **Abrir** → **Abrir**. Se o Node.js não estiver
instalado, o próprio arquivo baixa uma cópia só para esta pasta (sem senha), liga o estúdio
e abre o navegador. Se faltarem os arquivos do recorte em `model/`, ele procura
os `modelo-recorte-*.zip` na pasta Downloads e coloca no lugar. Deixe a janela do Terminal aberta enquanto usa.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
cd estudio-dormir-acordar
npm start
```

Abra http://localhost:5173 no Chrome, Edge ou Safari.

## Mexer com o Claude Code

Abra esta pasta no Claude Code (no app Claude, aba **Code**, ou no terminal com `claude`).
O arquivo `CLAUDE.md` explica para ele como o projeto funciona e as regras da marca. Exemplos de pedido:

- "Adicione um formato para Stories do Facebook."
- "Crie um cenário novo em tom terracota."
- "Mude o texto do botão padrão para 'Compre no site'."

## Testes

```bash
npm install
npx playwright install chromium
npm test
```

Para testar também o recorte e o frente e costas, coloque uma foto de modelo em `tests/fixtures/modelo.jpg`.

## Diferenças entre rodar local e no claude.ai

- **Já feitos:** local, fica guardado no navegador deste computador. No claude.ai, fica guardado na página.
- **Legendas com Claude:** só funcionam na página publicada no claude.ai. Para usar local, é preciso
  criar um pequeno servidor que chame a API da Anthropic com sua chave (peça ao Claude Code).
