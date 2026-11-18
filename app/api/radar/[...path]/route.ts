import type { NextRequest } from "next/server";
import { route } from "@/lib/api";
import { HttpError, getTenant } from "@/lib/tenant";
import { isDemoSlug } from "@/lib/demo";
import { RADAR_FILTERS, radarConfigured, radarFetch } from "@/lib/radar/api";

export const runtime = "nodejs";
export const maxDuration = 60;

// Só estas rotas da API da VPS ficam acessíveis pelo Fluxa.
const ROTAS = new Set(["empresas", "resumo", "mapa", "municipios", "cnaes", "exportar", "stats"]);
const MAX_POR_PAGINA = 50;
const MAX_EXPORTAR = 5000;

// A VPS é compartilhada: limite por instância para uma busca pesada não derrubar o resto.
// Empresas reais por código de acesso; demonstrações (visitantes anônimos) por IP.
const janela = new Map<string, number[]>();
function excedeu(chave: string, max: number) {
  const agora = Date.now();
  const recentes = (janela.get(chave) ?? []).filter((t) => agora - t < 600_000);
  recentes.push(agora);
  janela.set(chave, recentes);
  if (janela.size > 5000) janela.clear();
  return recentes.length > max;
}

const mascararFone = (t: unknown) => (t ? `${String(t).slice(0, 3)}••••${String(t).slice(-2)}` : null);
const mascararEmail = (e: unknown) => (e ? `••••@${String(e).split("@")[1] ?? ""}` : null);
type Linha = Record<string, unknown>;
// Na demonstração (aberta a qualquer visitante) os contatos reais não aparecem.
const mascarar = (e: Linha): Linha => ({
  ...e,
  telefone1: mascararFone(e.telefone1),
  telefone2: null,
  email: mascararEmail(e.email),
  contato_bloqueado: true,
});

// Repassa para a API da Receita (VPS) com a chave guardada no servidor.
export const GET = route(async (req: NextRequest) => {
  const t = await getTenant();
  if (!radarConfigured()) throw new HttpError(503, "A prospecção ainda não foi ligada neste ambiente.");

  const path = req.nextUrl.pathname.replace(/^\/api\/radar\/?/, "").split("/").filter(Boolean);
  if (!path.length || !ROTAS.has(path[0]) || path.length > 2 || (path.length === 2 && path[0] !== "empresas")) {
    throw new HttpError(404, "Rota não encontrada.");
  }

  const demo = isDemoSlug(t.clientSlug);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (demo ? excedeu(`ip:${ip}`, 40) : excedeu(`t:${t.clientSlug}`, 120)) {
    throw new HttpError(429, "Muitas buscas em pouco tempo. Aguarde alguns minutos.");
  }
  if (demo && path[0] === "exportar") throw new HttpError(403, "A exportação não está disponível na demonstração.");

  const entrada = req.nextUrl.searchParams;
  const q = new URLSearchParams();
  for (const k of RADAR_FILTERS) {
    const v = entrada.get(k);
    if (v) q.set(k, v.slice(0, 2000));
  }
  const limite = Number(q.get("limit"));
  if (path[0] === "exportar") q.set("limit", String(Math.min(limite || MAX_EXPORTAR, MAX_EXPORTAR)));
  else if (limite) q.set("limit", String(Math.min(limite, MAX_POR_PAGINA)));
  // a base só tem estabelecimentos ativos, mas a regra fica explícita
  if (path[0] === "empresas" && path.length === 1 && !q.has("situacao")) q.set("situacao", "2");

  const alvo = `${path.map(encodeURIComponent).join("/")}${q.size ? `?${q}` : ""}`;
  let res: Response;
  try {
    res = await radarFetch(alvo, { signal: req.signal });
  } catch {
    throw new HttpError(504, "A base de empresas demorou para responder. Tente de novo ou use mais filtros.");
  }

  if (demo && res.ok && path[0] === "empresas") {
    const corpo = await res.json();
    if (path.length === 1) corpo.resultados = ((corpo.resultados ?? []) as Linha[]).map(mascarar);
    else Object.assign(corpo, mascarar(corpo));
    return Response.json(corpo);
  }

  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "application/json" });
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("cache-control", "private, no-store");
  return new Response(res.body, { status: res.status, headers });
});
