#!/usr/bin/env bash
# Aplica as migrações pendentes (db/migrations) no banco de produção e nada mais.
# A URL é digitada aqui, escondida, e não é gravada em lugar nenhum.
# Use a URL de conexão "Session pooler" do Supabase (porta 5432), não a da porta 6543.
set -eu
cd "$(dirname "$0")/.."

read -r -s -p "Cole a URL do banco (Session pooler, porta 5432) e Enter: " url; echo
url="$(printf '%s' "$url" | tr -d '[:space:]')"
if [ -z "$url" ]; then echo "Nada colado. Cancelado."; exit 1; fi

DATABASE_URL="$url" npx tsx scripts/erp-migrate.ts
echo
echo "Pronto. Volte ao chat e escreva: migrado"
