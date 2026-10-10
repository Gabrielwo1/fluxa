# Arquitetura: banco mestre, um cliente por conexão Pluggy

## Ideia

Um único projeto Supabase (o "banco mestre") guarda todos os clientes. Cada cliente é
uma linha em `clients`, e **tudo o que é dele carrega o `client_id`**. O isolamento é
feito pelo próprio Postgres (RLS), não só pelo código do app: mesmo uma consulta mal
escrita não devolve dados de outro cliente.

No primeiro momento, cada cliente é uma **conexão Pluggy própria** (item do conector
MeuPluggy), registrada em `pluggy_connections`. Quando houver licença comercial da
Pluggy, a mesma tabela passa a guardar os itens dos conectores oficiais, sem mudar o app.

```
auth.users ──< memberships >── clients ──< pluggy_connections   (1 item Pluggy = 1 cliente)
     │                            ├──< fixed_bills
   staff                          ├──< category_rules
                                  └──< access_codes (1 código = 1 usuário do Auth)
leads (página de anúncios, só inserção anônima)
```

| Tabela | Para que serve |
| --- | --- |
| `clients` | Um cliente: nome, slug, status (`onboarding`, `active`, `paused`, `archived`) e `settings` (jsonb) para a configuração própria dele |
| `staff` | Quem opera a plataforma e enxerga todos os clientes (você e o sócio) |
| `memberships` | Quem do lado do cliente acessa o painel, com papel `owner`, `editor` ou `viewer` |
| `pluggy_connections` | Itens da Pluggy do cliente. `pluggy_item_id` é único no banco inteiro: um item nunca pertence a dois clientes |
| `fixed_bills` | Contas fixas do cliente |
| `category_rules` | Regras "este estabelecimento sempre vai nesta categoria", por cliente |
| `access_codes` | Metadados dos códigos de acesso de cada cliente (o código em si não é salvo) |
| `leads` | Contatos da página `/lp`. Visitante anônimo só insere; só a equipe lê |

## Quem pode o quê (RLS)

- **Equipe (`staff`)**: lê e escreve em tudo.
- **`owner` / `editor`**: lê e escreve só nos dados do próprio cliente.
- **`viewer`**: só lê os dados do próprio cliente.
- **Anônimo**: só insere em `leads` (com consentimento). Nada mais.
- Ninguém, pela API, vira `staff` nem cria cliente (só a equipe cria clientes).

O arquivo `supabase/migrations/20261005000000_multitenant_core.sql` foi testado num
Postgres local com 16 cenários de isolamento (editor do cliente A tentando ler, gravar,
apagar e mover dados do cliente B, registrar o item de outro cliente, virar equipe etc.).

## Como o front na Vercel conversa com o banco

```
Navegador ──(cookie de sessão Supabase)──> Vercel (Next.js)
                                             ├─ proxy.ts: renova a sessão e barra quem não logou
                                             ├─ /api/*: descobre o cliente (lib/tenant.ts) e
                                             │          consulta o Supabase com a SESSÃO do usuário (RLS)
                                             └─ /api/* ──> Pluggy (segredo só no servidor)
```

- A chave do Supabase no navegador é a **publishable** (pública por desenho). O poder vem
  do login do usuário + RLS. Não há `service_role` no app.
- O app **não confia no `itemId` que o navegador manda**: antes de chamar a Pluggy, confere
  se o item está em `pluggy_connections` do cliente atual (`lib/pluggy-guard.ts`).
- Ao gerar o token do widget, o app envia `clientUserId = id do cliente`. Ao registrar a
  conexão, confere que o item foi criado com esse id (a equipe pode registrar itens antigos).
- Credenciais da Pluggy (`PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET`) ficam só no servidor.
- Sem as variáveis do Supabase, o app roda em **modo local** (arquivos em `data/`), só para
  desenvolvimento. Na Vercel, sem Supabase, as APIs respondem 503 de propósito.

## Acesso por código

Cada pessoa do cliente pode entrar com um **código pessoal** (`FLX-XXXX-XXXX-XXXX-XXXX`) em vez de
e-mail e senha. Na tela de login, a aba "Código de acesso" é a padrão.

- **Como funciona por trás:** cada código é um usuário do Supabase Auth cuja senha é o código,
  vinculado ao cliente em `memberships` (com papel `viewer`, `editor` ou `owner`). Logo, o
  isolamento por RLS vale igual para quem entra por código ou por e-mail.
- **Formato:** `FLX` + 4 caracteres públicos (identificam o acesso) + 12 secretos (~59 bits), em um
  alfabeto sem `0/O/1/I/L`. O código nunca é salvo: o Auth guarda só o hash da senha, e a tabela
  `access_codes` guarda apenas metadados (rótulo, papel, validade, último uso).
- **Gerar e revogar:** a equipe usa a página **Acessos** (menu, só para a equipe). O código aparece
  uma única vez. Revogar apaga o usuário: o acesso cai na hora e o vínculo sai em cascata.
- **Validade opcional** (7 dias a 1 ano) e último uso registrado.
- **Proteções no login:** resposta única para código inválido, expirado ou revogado; limite de
  8 tentativas por IP em 10 minutos (por instância) além do limite do próprio Supabase Auth.
- **Requer no servidor:** `SUPABASE_SERVICE_ROLE_KEY` (ignora o RLS; só no servidor, nunca com
  `NEXT_PUBLIC_`) e `ACCESS_EMAIL_BASE` (uma caixa sua; cada código vira `voce+fx-abcd@dominio`,
  que nunca é usado para enviar e-mail). Migração: `20261005010000_access_codes.sql`.

## Modo MVP (sem banco)

Para testar com um cliente antes de o Supabase estar no ar, o app aceita um **código de acesso
definido em variáveis de ambiente**. Qualquer texto serve como código, o que é prático e **fraco**:
use só em teste e troque por um código gerado (ou mais longo) antes de ir adiante.

- `MVP_ACCESS_CODE_<SLUG>` define o código do cliente (vários, separados por vírgula),
  `MVP_ITEMS_<SLUG>` lista as conexões da Pluggy dele e `SESSION_SECRET` assina o cookie.
- O login valida o código no servidor (comparação por hash, sem diferença de tempo, ignorando
  maiúsculas), limita tentativas por IP e abre uma sessão de 7 dias em cookie `httpOnly` assinado.
- A sessão enxerga **só aquele cliente** e é **somente leitura**: não altera contas fixas, regras
  nem conexões, e não gera token do widget. Nada disso é gravado (não há banco).
- Quando o Supabase estiver configurado, os dois modos convivem: o código é testado primeiro
  contra o ambiente e, se não for dele, contra os códigos gerados (`FLX-...`).

## Apresentação comercial

A rota pública `/apresentacao` é um conjunto de 13 slides (setas, espaço, toque, tela cheia, "ver
todos" e PDF pelo botão de impressora). O slide atual fica no hash da URL (`/apresentacao#6`).

## Onboarding assistido de um cliente

1. `insert into clients` (status `onboarding`).
2. Criar o usuário do cliente em **Authentication > Users** e vincular em `memberships`.
3. Logar como equipe, escolher o cliente no seletor do topo e clicar em **Conectar banco**
   (ou passar o link de login ao cliente para ele mesmo autorizar no Meu Pluggy).
4. Cadastrar contas fixas e ajustar categorias no painel.
5. Mudar o status para `active`.

## Deploy (Vercel + Supabase)

1. Supabase: rodar no SQL Editor, em ordem, `supabase/migrations/20261005000000_multitenant_core.sql` e `20261005010000_access_codes.sql`.
   Depois rodar o seu seed local (`supabase/seed.piloto.sql`) e o trecho de `staff` de `supabase/seed.sql`.
2. Vercel: definir as variáveis de `.env.example` (Settings > Environment Variables). `SUPABASE_SERVICE_ROLE_KEY` e `PLUGGY_CLIENT_SECRET` só como variáveis de servidor.
3. Supabase > Authentication > URL Configuration: incluir o domínio da Vercel em Site URL / Redirect URLs.
4. A região das funções está em `gru1` (São Paulo) em `vercel.json`, perto do Supabase `sa-east-1`.

## Atenção

- O conector **MeuPluggy é de uso pessoal** (até 5 conexões por titular). Servir clientes com ele
  é uma etapa de validação; antes de cobrar mensalidade, contratar o plano comercial da Pluggy.
- As fotos de `public/lp/` são do banco de imagens (Freepik) e estão versionadas neste repositório,
  que é público, por decisão do dono do projeto. A licença da Freepik não prevê distribuir os
  arquivos de forma que outras pessoas possam baixá-los; se isso virar um problema, tornar o
  repositório privado resolve sem mudar mais nada. O crédito à Freepik fica no rodapé da página.

## Módulo fiscal: emissão de NFS-e

Veio do app Nota MEI IA e passou a morar aqui. A parte difícil (assinar o DPS, falar com o
ambiente nacional, ler o XML, desenhar o PDF) não depende de tela nem de login, então atravessou
quase sem edição; o que foi reescrito é a casca: dados por cliente e telas no desenho do Fluxa.

```
lib/nfse/          DPS, assinatura XMLDSIG, API Sefin (mTLS), portal, ADN, DANFSe, importador
lib/ai/agente.ts   assistente que monta o rascunho (OpenAI, com ferramentas)
lib/cnae.ts        CNAE do CNPJ -> código de serviço (cTribNac) sugerido
lib/servicos.ts    lista nacional de serviços (LC 116) com busca por palavra
lib/cnpj.ts        consulta pública da Receita (BrasilAPI)
lib/financeiro.ts  faturamento por mês, limite anual do MEI, principais clientes
lib/nfse-store.ts  dados por cliente (Supabase com RLS, ou arquivo em modo local)
app/api/nfse/*     rotas: emitente, cnpj, credenciais, chat, emitir, notas, importar, resumo
```

Tabelas em `supabase/migrations/20261008000000_nfse.sql`: `emitentes`, `emitente_credenciais`,
`notas_fiscais` e `contadores_dps`. Todas carregam `client_id` e repetem a política do resto do
painel: equipe vê tudo, `owner`/`editor` escrevem, `viewer` só lê — ou seja, **viewer não emite**.
Um cliente é uma empresa, então tem um emitente (unique em `client_id`).

Três coisas que valem saber:

- **Quem emite é a pessoa, não a IA.** O assistente só prepara o rascunho; a rota de emissão é a
  única que fala com o governo, e só roda quando alguém aperta o botão.
- **O navegador nunca diz de quem é a nota.** O emitente sai do `getTenant()`, igual ao resto do
  painel. As credenciais de emissão são cifradas (AES-256-GCM, `CREDENCIAIS_CHAVE`) e nunca voltam
  para o cliente.
- **A3 não emite ainda.** A chave fica dentro do token e nenhum servidor assina por ela; guardamos
  o número de série e a emissão recusa com a instrução, antes de reservar número de DPS.

A automação do Emissor Nacional usa Chromium: na Vercel vem do `@sparticuz/chromium`, no
desenvolvimento usa o Chrome instalado (`lib/nfse/navegador.ts`). O `next.config.ts` inclui à mão
os arquivos que esses pacotes leem por caminho, senão a função sobe sem eles.

## Próximos passos sugeridos

- Cache das transações no Supabase (hoje cada abertura consulta 12 meses na Pluggy).
- `audit_log` por cliente para registrar o que foi ajustado na construção assistida.
- Tela de administração para criar cliente e usuário sem SQL.
- Ligar os dois lados: transação recebida vira sugestão de nota, nota emitida entra na previsão de
  caixa, e o limite do MEI aparece junto do resto do financeiro.

## Aplicação da Pluggy por cliente (opcional)

Por padrão, todos os clientes usam a aplicação da Pluggy da Fluxa (`PLUGGY_CLIENT_ID` /
`PLUGGY_CLIENT_SECRET`). Se um cliente conectou os bancos na própria conta do Pluggy Dashboard, os
itens existem na aplicação dele, e só as credenciais dela conseguem lê-los. Nesse caso defina, só
como variáveis de servidor, `PLUGGY_CLIENT_ID_<SLUG>` e `PLUGGY_CLIENT_SECRET_<SLUG>` (slug em
maiúsculas, ex.: `MOTTA`). O painel escolhe as credenciais pelo cliente atual, inclusive ao gerar o
token do widget, de modo que novas conexões nascem na aplicação certa.

Para ver um cliente localmente sem o Supabase: `npm run dev:motta` (usa `data/clients/motta/` e as
credenciais `*_MOTTA`).

## Onde o módulo fiscal parou (08–10/10/2026)

O que está pronto e verificado contra o banco real, com RLS: cadastro do emitente pela Receita,
credenciais cifradas, nota manual, emissão em simulação, PDF da DANFSe, lista, resumo com o limite
anual e o isolamento entre clientes (o dono vê os dados dele, um usuário sem vínculo vê zero).

O banco mestre `uuloyfpnksqyrtcabgqh` foi criado agora: as três migrações estão aplicadas e as
tabelas estão vazias. Para entrar pela primeira vez, `scripts/preparar-acesso.sh` cria o usuário da
equipe, um cliente e o vínculo.

**Produção ainda roda em modo MVP** (só Pluggy, código de acesso e `SESSION_SECRET` na Vercel).
As variáveis do Supabase e do fiscal já estão cadastradas lá, mas `NEXT_PUBLIC_*` só entram no
build: **o modo só muda no próximo deploy**. Antes de publicar, confirmar como fica o acesso de
quem já usa o painel pelo código MVP.

O que ainda não foi testado de ponta a ponta: emissão de verdade no ambiente nacional (depende de
certificado A1 ou da senha do Emissor Nacional de um cliente real) e a importação do histórico pelo
portal, cuja leitura de tela foi escrita como ponto de partida. O A3 continua guardando só o número
de série, por decisão: a assinatura dele exige um componente instalado na máquina de quem emite.
