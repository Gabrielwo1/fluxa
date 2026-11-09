#!/usr/bin/env bash
# Liga o banco de dados do ERP em produção, em um comando:
#   1. aplica as migrações no banco (cria as tabelas)
#   2. guarda a DATABASE_URL na Vercel (variável sensível, de produção)
#   3. publica de novo para a variável valer
#
# Uso:
#   DATABASE_URL='postgresql://usuario:senha@host:5432/banco' bash scripts/erp-setup.sh
#
# Qualquer Postgres serve (Neon pela Vercel, Supabase, Railway…). Veja docs/ERP.md.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Defina DATABASE_URL (veja o cabeçalho deste arquivo)." >&2
  exit 1
fi

echo "1/3 Aplicando migrações…"
DATABASE_URL="$DATABASE_URL" npx tsx scripts/erp-migrate.ts

echo "2/3 Guardando DATABASE_URL na Vercel (produção)…"
# o CLI da Vercel pode reescrever o .env.local; guarda uma cópia antes
[ -f .env.local ] && cp .env.local ".env.local.bak-$(date +%s)"
printf %s "$DATABASE_URL" | vercel env add DATABASE_URL production --sensitive --force >/dev/null
echo "    ok"

echo "3/3 Publicando…"
vercel deploy --prod --yes | tail -3
echo "Pronto. Abra o painel e entre normalmente."
