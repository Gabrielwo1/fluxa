# Fluxa

Painel financeiro conectado ao Open Finance (Pluggy), com um banco mestre no Supabase
onde cada cliente tem os seus próprios dados. Front em Next.js, pensado para a Vercel.

- Arquitetura e passo a passo de deploy: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Banco: [supabase/migrations](supabase/migrations)
- Variáveis de ambiente: [.env.example](.env.example)

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha; sem Supabase o app roda em modo local
npm run dev
```

- `/` painel (exige login quando o Supabase está configurado)
- `/lp` página de anúncios
- `/login` entrada de clientes e equipe
