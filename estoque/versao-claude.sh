#!/bin/sh
# Gera a versão do estoque para publicar no claude.ai (Artifact com banco de dados).
# O claude.ai coloca o <!doctype>, <html>, <head> e <body> sozinho, então eles saem daqui.
# Uso: sh estoque/versao-claude.sh /caminho/de/saida.html
sed -e '/^<!doctype html>$/d' -e '/^<html lang="pt-BR">$/d' -e '/^<head>$/d' -e '/^<\/head>$/d' \
    -e '/^<body>$/d' -e '/^<\/body>$/d' -e '/^<\/html>$/d' \
    -e '/^<meta charset="utf-8">$/d' -e '/^<meta name="viewport"/d' "$(dirname "$0")/index.html" > "$1"
