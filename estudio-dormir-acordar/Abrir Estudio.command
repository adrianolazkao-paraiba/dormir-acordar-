#!/bin/bash
# Abre o Estúdio Dormir & Acordar no Mac com dois cliques.
# Se o Node.js não estiver instalado, baixa uma cópia só para esta pasta (sem senha de administrador).
cd "$(dirname "$0")" || exit 1

NODE_VER="v22.22.0"
PORTA=5173

echo ""
echo "  Estúdio Dormir & Acordar"
echo "  ------------------------"

if command -v node >/dev/null 2>&1; then
  NODE="node"
else
  case "$(uname -m)" in
    arm64) ARQ="arm64" ;;
    *)     ARQ="x64" ;;
  esac
  PASTA=".node/node-$NODE_VER-darwin-$ARQ"
  NODE="$PASTA/bin/node"
  if [ ! -x "$NODE" ]; then
    echo "  Baixando o Node.js (só na primeira vez, uns 45 MB)..."
    mkdir -p .node
    if ! curl -fL --progress-bar "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-darwin-$ARQ.tar.gz" -o .node/node.tar.gz; then
      echo ""
      echo "  Não consegui baixar o Node.js. Confira a internet e tente de novo."
      read -r -p "  Aperte Enter para fechar."
      exit 1
    fi
    tar -xzf .node/node.tar.gz -C .node && rm -f .node/node.tar.gz
  fi
fi

# Se já estiver aberto, só abre o navegador
if curl -s -o /dev/null "http://localhost:$PORTA"; then
  open "http://localhost:$PORTA"
  exit 0
fi

echo "  Ligando o estúdio..."
PORT=$PORTA "$NODE" server.mjs &
SERVIDOR=$!
for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://localhost:$PORTA" && break
  sleep 0.3
done
open "http://localhost:$PORTA"

echo ""
echo "  Pronto! O estúdio está aberto em http://localhost:$PORTA"
echo "  Deixe esta janela aberta enquanto usa. Para desligar, feche esta janela."
echo ""
wait $SERVIDOR
