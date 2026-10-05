import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { HttpError, canEdit, type Tenant } from "@/lib/tenant";

// Todos os dados do cliente passam por aqui. Em modo Supabase, as consultas
// usam a sessão do usuário (RLS) e sempre filtram por client_id. Em modo local
// (só desenvolvimento), usa arquivos em data/.

export type Bill = { id: string; name: string; amount: number; day: number };

// modo local: LOCAL_CLIENT=motta guarda tudo em data/clients/motta/
const DATA_DIR = process.env.LOCAL_CLIENT
  ? path.join(process.cwd(), "data", "clients", process.env.LOCAL_CLIENT)
  : path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function fail(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (error.code === "42501") throw new HttpError(403, "Sem permissão");
  if (error.code === "23505") throw new HttpError(409, "Já existe");
  throw new HttpError(500, error.message);
}

function requireEdit(t: Tenant) {
  if (!canEdit(t)) throw new HttpError(403, "Seu acesso é somente leitura");
}

// ----- conexões com a Pluggy -----

export async function listConnectionIds(t: Tenant): Promise<string[]> {
  if (t.mode === "local") return readJson<string[]>("items.json", []);
  const { data, error } = await t
    .db!.from("pluggy_connections")
    .select("pluggy_item_id")
    .eq("client_id", t.clientId)
    .eq("status", "active")
    .order("connected_at");
  fail(error);
  return (data ?? []).map((r) => r.pluggy_item_id as string);
}

export async function addConnection(
  t: Tenant,
  itemId: string,
  meta: { connector?: string | null; label?: string | null } = {}
): Promise<void> {
  requireEdit(t);
  if (t.mode === "local") {
    const ids = await readJson<string[]>("items.json", []);
    await writeJson("items.json", Array.from(new Set([...ids, itemId])));
    return;
  }
  const { error } = await t.db!.from("pluggy_connections").insert({
    client_id: t.clientId,
    pluggy_item_id: itemId,
    connector_name: meta.connector ?? null,
    label: meta.label ?? null,
    created_by: t.userId,
  });
  fail(error);
}

export async function removeConnection(t: Tenant, itemId: string): Promise<void> {
  requireEdit(t);
  if (t.mode === "local") {
    const ids = await readJson<string[]>("items.json", []);
    await writeJson("items.json", ids.filter((x) => x !== itemId));
    return;
  }
  const { error } = await t
    .db!.from("pluggy_connections")
    .delete()
    .eq("client_id", t.clientId)
    .eq("pluggy_item_id", itemId);
  fail(error);
}

// ----- contas fixas -----

export async function listBills(t: Tenant): Promise<Bill[]> {
  if (t.mode === "local") return readJson<Bill[]>("fixed-bills.json", []);
  const { data, error } = await t
    .db!.from("fixed_bills")
    .select("id, name, amount, day")
    .eq("client_id", t.clientId)
    .eq("active", true)
    .order("sort_order")
    .order("created_at");
  fail(error);
  return (data ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    amount: Number(b.amount),
    day: Number(b.day),
  }));
}

export async function addBill(
  t: Tenant,
  input: { name: string; amount: number; day: number }
): Promise<void> {
  requireEdit(t);
  const day = Math.min(31, Math.max(1, Math.round(input.day) || 1));
  if (t.mode === "local") {
    const bills = await readJson<Bill[]>("fixed-bills.json", []);
    bills.push({ id: randomUUID(), name: input.name, amount: input.amount, day });
    await writeJson("fixed-bills.json", bills);
    return;
  }
  const { error } = await t.db!.from("fixed_bills").insert({
    client_id: t.clientId,
    name: input.name,
    amount: input.amount,
    day,
  });
  fail(error);
}

export async function removeBill(t: Tenant, id: string): Promise<void> {
  requireEdit(t);
  if (t.mode === "local") {
    const bills = await readJson<Bill[]>("fixed-bills.json", []);
    await writeJson("fixed-bills.json", bills.filter((b) => b.id !== id));
    return;
  }
  const { error } = await t
    .db!.from("fixed_bills")
    .delete()
    .eq("client_id", t.clientId)
    .eq("id", id);
  fail(error);
}

// ----- regras de categoria -----

export async function getRules(t: Tenant): Promise<Record<string, string>> {
  if (t.mode === "local") return readJson<Record<string, string>>("category-rules.json", {});
  const { data, error } = await t
    .db!.from("category_rules")
    .select("merchant_key, category")
    .eq("client_id", t.clientId);
  fail(error);
  return Object.fromEntries(
    (data ?? []).map((r) => [r.merchant_key as string, r.category as string])
  );
}

export async function setRule(
  t: Tenant,
  key: string,
  category: string | null
): Promise<void> {
  requireEdit(t);
  if (t.mode === "local") {
    const rules = await readJson<Record<string, string>>("category-rules.json", {});
    if (category) rules[key] = category;
    else delete rules[key];
    await writeJson("category-rules.json", rules);
    return;
  }
  if (category) {
    const { error } = await t
      .db!.from("category_rules")
      .upsert(
        { client_id: t.clientId, merchant_key: key, category },
        { onConflict: "client_id,merchant_key" }
      );
    fail(error);
  } else {
    const { error } = await t
      .db!.from("category_rules")
      .delete()
      .eq("client_id", t.clientId)
      .eq("merchant_key", key);
    fail(error);
  }
}
