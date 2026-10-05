import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { assertAccountAllowed } from "@/lib/pluggy-guard";
import { pluggyFor } from "@/lib/pluggy-client";

type V2Page = { results: unknown[]; next: string | null };

export const GET = route(async (req) => {
  const t = await getTenant();
  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) throw new HttpError(400, "accountId obrigatório");
  await assertAccountAllowed(t, accountId);

  const params = new URLSearchParams({ accountId });
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (from) params.set("dateFrom", from);
  if (to) params.set("dateTo", to);

  const results: unknown[] = [];
  let path: string | null = `/v2/transactions?${params.toString()}`;
  // "next" da API v2 vem como query string pronta; limite de segurança de páginas
  for (let i = 0; i < 20 && path; i++) {
    const page: V2Page = await pluggyFor(t).get<V2Page>(path);
    results.push(...(page.results ?? []));
    const next = page.next;
    if (!next) path = null;
    else if (next.startsWith("http")) path = `/v2/transactions${new URL(next).search}`;
    else if (next.startsWith("?")) path = `/v2/transactions${next}`;
    else path = `/v2/transactions?${params.toString()}&after=${encodeURIComponent(next)}`;
  }
  return NextResponse.json({ results });
});
