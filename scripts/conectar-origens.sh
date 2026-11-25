#!/usr/bin/env bash
# Liga a busca automática de uma empresa no Fluxa (produção): atendente (com o Mercado Livre que ele já tem)
# e loja Shopify. Tudo é digitado aqui, escondido, e vai direto para a Vercel como variável sensível.
# Nada passa pelo chat nem fica em arquivo. Veja docs/INTEGRACOES.md.
#
# Uso: bash scripts/conectar-origens.sh
set -u
cd "$(dirname "$0")/.."

read -r -p "Identificador da empresa no Fluxa (ex.: miranda): " slug
slug="$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
[ -z "$slug" ] && { echo "Identificador vazio. Cancelado."; exit 1; }
SUF="$(printf '%s' "$slug" | tr '[:lower:]' '[:upper:]')"

salvar() { # nome valor [sensitive]
  vercel env rm "$1" production --yes >/dev/null 2>&1
  if [ "${3:-}" = "sensitive" ]; then printf '%s' "$2" | vercel env add "$1" production --sensitive >/dev/null 2>&1
  else printf '%s' "$2" | vercel env add "$1" production >/dev/null 2>&1; fi
  if [ $? -eq 0 ]; then echo "  ok  $1"; else echo "  FALHOU  $1"; fi
}

echo
echo "== Atendente Syntax (traz também o Mercado Livre conectado nele) =="
read -r -p "Endereço do atendente (ex.: https://atendente-syntax.vercel.app, Enter para pular): " url
if [ -n "$url" ]; then
  read -r -p "Identificador do cliente no atendente [veipar]: " aslug; aslug="${aslug:-veipar}"
  read -r -s -p "Código de acesso do painel desse cliente (não aparece): " code; echo
  salvar "ATENDENTE_URL_$SUF" "${url%/}"
  salvar "ATENDENTE_SLUG_$SUF" "$aslug"
  salvar "ATENDENTE_CODE_$SUF" "$code" sensitive
fi

echo
echo "== Loja (Shopify) =="
read -r -p "Domínio myshopify da loja (ex.: xn7tfb-iw.myshopify.com, Enter para pular): " dom
if [ -n "$dom" ]; then
  read -r -p "Client ID do app Admin da loja: " cid
  read -r -s -p "Client secret (não aparece): " csec; echo
  salvar "SHOPIFY_DOMAIN_$SUF" "$dom"
  salvar "SHOPIFY_CLIENT_ID_$SUF" "$cid" sensitive
  salvar "SHOPIFY_CLIENT_SECRET_$SUF" "$csec" sensitive
  read -r -p "URL do Supabase onde a loja grava os acessos (Enter para pular os números de visitas): " surl
  if [ -n "$surl" ]; then
    read -r -s -p "Chave service_role desse Supabase (não aparece): " skey; echo
    salvar "LOJA_SUPABASE_URL_$SUF" "${surl%/}"
    salvar "LOJA_SUPABASE_KEY_$SUF" "$skey" sensitive
  fi
fi

echo
echo "As variáveis só valem em um novo deploy. Depois dele, o agendador busca a cada 3 horas e"
echo "a tela Integrações tem o botão \"Sincronizar agora\"."
read -r -p "Publicar agora com um deploy vazio? (s/n) " r
if [ "$r" = "s" ]; then
  git commit --allow-empty -q -m "Origens de dados: $slug" && git push -q origin main && echo "Deploy iniciado."
else
  echo "Ok. Quando quiser: git commit --allow-empty -m 'Origens de dados' && git push"
fi
