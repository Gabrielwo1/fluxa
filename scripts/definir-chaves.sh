#!/usr/bin/env bash
# Guarda as chaves do Fluxa na Vercel (produção). Cada valor é digitado aqui, escondido, e vai direto
# para a Vercel como variável sensível: não passa pelo chat nem fica gravado em arquivo.
# Enter em branco = pula a variável (mantém o que já existe).
set -u
cd "$(dirname "$0")/.."

# O CLI da Vercel às vezes reescreve o .env.local; guarda uma cópia antes.
[ -f .env.local ] && cp .env.local ".env.local.bak" && echo "Cópia do .env.local salva em .env.local.bak"

# nome | descrição | tipo (secreto = escondido e sensível, publico = visível)
VARS=(
  "RADAR_API_URL|Endereço da API do Radar na VPS (https://...)|publico"
  "RADAR_API_KEY|Chave da API do Radar (API_KEY do projeto radarb2b)|secreto"
  "OPENAI_API_KEY|Chave da OpenAI (chat de ajuda)|secreto"
  "NEXT_PUBLIC_WHATSAPP|WhatsApp da equipe com DDI e DDD, só dígitos (ex.: 5546999999999)|publico"
  "MP_ACCESS_TOKEN|Mercado Pago: Access Token de produção|secreto"
  "NEXT_PUBLIC_MP_PUBLIC_KEY|Mercado Pago: Public Key de produção|publico"
  "MP_WEBHOOK_SECRET|Mercado Pago: assinatura secreta do webhook (opcional)|secreto"
)

for item in "${VARS[@]}"; do
  IFS='|' read -r name desc kind <<<"$item"
  # com argumentos (ex.: bash scripts/definir-chaves.sh OPENAI_API_KEY), pergunta só essas
  if [ $# -gt 0 ] && [[ " $* " != *" $name "* ]]; then continue; fi
  echo
  echo "$name — $desc"
  if [ "$kind" = "secreto" ]; then
    read -r -s -p "  cole o valor (não aparece) e Enter: " value; echo
  else
    read -r -p "  cole o valor e Enter: " value
  fi
  value="$(printf '%s' "$value" | tr -d '[:space:]')"
  if [ -z "$value" ]; then echo "  pulado"; continue; fi

  vercel env rm "$name" production --yes >/dev/null 2>&1   # troca o valor se já existir
  if [ "$kind" = "secreto" ]; then
    printf '%s' "$value" | vercel env add "$name" production --sensitive >/dev/null 2>&1
  else
    printf '%s' "$value" | vercel env add "$name" production >/dev/null 2>&1
  fi
  if [ $? -eq 0 ]; then echo "  salvo na Vercel (produção)"; else echo "  FALHOU ao salvar $name"; fi
done

echo
echo "Pronto. Confira a lista (só os nomes):"
vercel env ls production 2>/dev/null | grep -E "RADAR_|OPENAI|WHATSAPP|MP_" || true
echo
echo "Volte ao chat e escreva: pronto"
