#!/usr/bin/env bash
# Cadastra um cliente novo no Fluxa (produção): código de acesso, nome e, se quiser, a credencial
# da Pluggy dele (Open Finance). Tudo é digitado aqui, escondido, e vai direto para a Vercel como
# variável sensível. Nada passa pelo chat nem fica em arquivo.
#
# Uso: bash scripts/novo-cliente.sh
set -u
cd "$(dirname "$0")/.."

[ -f .env.local ] && cp .env.local .env.local.bak

read -r -p "Identificador do cliente (letras minúsculas, sem espaço. Ex.: miranda): " slug
slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
[ -z "$slug" ] && { echo "Identificador vazio. Cancelado."; exit 1; }
SUF="$(printf '%s' "$slug" | tr '[:lower:]' '[:upper:]')"

read -r -p "Nome da empresa (como aparece no painel): " nome
read -r -s -p "Código de acesso do cliente (mínimo 8 caracteres, não aparece): " codigo; echo
codigo="$(printf '%s' "$codigo" | tr -d '[:space:]')"
if [ "${#codigo}" -lt 8 ]; then echo "Código curto demais (use 8 ou mais, de preferência misturando letras e números). Cancelado."; exit 1; fi
read -r -p "Pluggy Client ID do cliente (Enter para usar o padrão do Fluxa): " pid
if [ -n "$pid" ]; then read -r -s -p "Pluggy Client Secret (não aparece): " psec; echo; fi

salvar() { # nome valor [sensitive]
  vercel env rm "$1" production --yes >/dev/null 2>&1
  if [ "${3:-}" = "sensitive" ]; then printf '%s' "$2" | vercel env add "$1" production --sensitive >/dev/null 2>&1
  else printf '%s' "$2" | vercel env add "$1" production >/dev/null 2>&1; fi
  if [ $? -eq 0 ]; then echo "  ok  $1"; else echo "  FALHOU  $1"; fi
}

echo
salvar "MVP_ACCESS_CODE_$SUF" "$codigo" sensitive
[ -n "$nome" ] && salvar "MVP_CLIENT_NAME_$SUF" "$nome"
if [ -n "${pid:-}" ] && [ -n "${psec:-}" ]; then
  salvar "PLUGGY_CLIENT_ID_$SUF" "$pid" sensitive
  salvar "PLUGGY_CLIENT_SECRET_$SUF" "$psec" sensitive
fi

echo
echo "As variáveis só valem em um novo deploy."
read -r -p "Publicar agora com um deploy vazio? (s/n) " r
if [ "$r" = "s" ]; then
  git commit --allow-empty -q -m "Novo cliente: $slug" && git push -q origin main && echo "Deploy iniciado. Em ~1 minuto o cliente já entra com o código."
else
  echo "Ok. Quando quiser: git commit --allow-empty -m 'Novo cliente' && git push"
fi
