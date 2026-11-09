// Aplica db/migrations/*.sql no banco do ERP (DATABASE_URL), uma vez cada, em ordem.
//   npm run erp:migrate
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { Client } from "pg";

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^DATABASE_URL=(.*)$/);
      if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Defina DATABASE_URL (veja docs/ERP.md).");
    process.exit(1);
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  const client = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  await client.query(
    "create table if not exists erp_migrations (name text primary key, applied_at timestamptz not null default now())"
  );
  const done = new Set((await client.query("select name from erp_migrations")).rows.map((r) => r.name));
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    process.stdout.write(`aplicando ${f}… `);
    try {
      await client.query("begin");
      await client.query(readFileSync(path.join(dir, f), "utf8"));
      await client.query("insert into erp_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log("ok");
      applied++;
    } catch (e) {
      await client.query("rollback");
      console.log("ERRO");
      console.error((e as Error).message);
      process.exit(1);
    }
  }
  console.log(applied ? `${applied} migração(ões) aplicada(s).` : "Banco já está em dia.");
  await client.end();
}

main();
