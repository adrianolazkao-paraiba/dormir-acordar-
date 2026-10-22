# pmfc-sorteio
PMFC – Sistema de Sorteio de Atletas (Futebol Society)

## Estúdio Dormir & Acordar

A pasta [`estudio-dormir-acordar/`](estudio-dormir-acordar/) tem o estúdio de conteúdo da marca Dormir & Acordar
(posts para Instagram, TikTok, TikTok Shop, Pinterest e marketplaces). Veja o README de lá para rodar.

**Abrir no celular, tablet ou computador:** https://adrianolazkao-paraiba.github.io/dormir-acordar-/estudio-dormir-acordar/
(no iPhone/iPad: Compartilhar → Adicionar à Tela de Início; no Android: menu ⋮ → Instalar app / Adicionar à tela inicial).

**App Android (funciona sem internet):** baixe no celular
https://github.com/adrianolazkao-paraiba/dormir-acordar-/releases/latest/download/estudio-dormir-acordar.apk
e toque no arquivo para instalar (permita "instalar apps desta fonte" se o celular pedir).

## Controle de estoque

A pasta [`estoque/`](estoque/) tem o controle de estoque, vendas e MEI da Dormir & Acordar (produtos por modelo, cor e
tamanho, entradas, vendas, custo médio, inventário, limite do MEI, DAS e Relatório Mensal de Receitas Brutas).

**Com banco de dados compartilhado (use este):** https://claude.ai/artifact/9URzLFf18CzvpFiqyNDuxM
— os dados ficam no banco do claude.ai e aparecem ao vivo para todos que o dono convidar pelo botão Compartilhar.

**Sem banco (só no aparelho):** https://adrianolazkao-paraiba.github.io/dormir-acordar-/estoque/
— mesma página, mas os dados ficam só no navegador de quem usa.

Para atualizar a versão do claude.ai depois de mudar `estoque/index.html`: `sh estoque/versao-claude.sh saida.html`
e publique `saida.html` (com `logo.jpg`, `icone.png` e `icone-180.png`) no mesmo link.
