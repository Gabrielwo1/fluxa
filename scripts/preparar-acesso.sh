#!/usr/bin/env bash
# Primeiro acesso ao banco mestre: cria o usuário da equipe, um cliente e o vínculo entre eles.
#
# Sem isso ninguém entra no painel em modo Supabase: o login autentica, mas getTenant() recusa
# quem não tem cliente vinculado. Rode uma vez, com a sua senha — ela não passa por mais ninguém.
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_... EMAIL=voce@exemplo.com SENHA='sua-senha-forte' \
#   CLIENTE='Minha Empresa' SLUG=minha-empresa bash scripts/preparar-acesso.sh
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-uuloyfpnksqyrtcabgqh}"
CLIENTE="${CLIENTE:-Meu Cliente}"
SLUG="${SLUG:-cliente}"

faltou=""
for v in SUPABASE_ACCESS_TOKEN EMAIL SENHA; do
  [ -z "${!v:-}" ] && faltou="$faltou $v"
done
if [ -n "$faltou" ]; then
  echo "Faltou:$faltou — veja o cabeçalho deste arquivo." >&2
  exit 1
fi

sql() {
  curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$1")"
}

# A chave de serviço só serve para criar o usuário já confirmado; não fica salva em lugar nenhum.
SERVICO=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$REF/api-keys?reveal=true" |
  python3 -c "import json,sys; print(next((k['api_key'] for k in json.load(sys.stdin) if k.get('name')=='service_role'), ''))")
[ -z "$SERVICO" ] && { echo "Não consegui ler as chaves do projeto $REF." >&2; exit 1; }

URL="https://$REF.supabase.co"
USUARIO=$(curl -s "$URL/auth/v1/admin/users?page=1&per_page=200" -H "apikey: $SERVICO" -H "Authorization: Bearer $SERVICO" |
  python3 -c "
import json,sys,os
u=[x for x in json.load(sys.stdin)['users'] if x['email']==os.environ['EMAIL']]
print(u[0]['id'] if u else '')")

if [ -z "$USUARIO" ]; then
  USUARIO=$(curl -s -X POST "$URL/auth/v1/admin/users" -H "apikey: $SERVICO" -H "Authorization: Bearer $SERVICO" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c "
import json,os
print(json.dumps({'email': os.environ['EMAIL'], 'password': os.environ['SENHA'], 'email_confirm': True}))")" |
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))")
  echo "usuário criado"
else
  echo "usuário já existia"
fi
[ -z "$USUARIO" ] && { echo "Não consegui criar o usuário." >&2; exit 1; }

sql "insert into staff (user_id) values ('$USUARIO') on conflict do nothing;" > /dev/null
CID=$(sql "insert into clients (name, slug, status) values ('$CLIENTE', '$SLUG', 'active')
  on conflict (slug) do update set name = excluded.name returning id;" |
  python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
sql "insert into memberships (client_id, user_id, role) values ('$CID', '$USUARIO', 'owner') on conflict do nothing;" > /dev/null

echo "equipe: $EMAIL"
echo "cliente: $CLIENTE ($SLUG)"
echo "pronto — entre em /login pela aba \"E-mail e senha\"."
