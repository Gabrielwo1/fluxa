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

## Próximos passos sugeridos

- Cache das transações no Supabase (hoje cada abertura consulta 12 meses na Pluggy).
- `audit_log` por cliente para registrar o que foi ajustado na construção assistida.
- Tela de administração para criar cliente e usuário sem SQL.
