import { NextRequest } from "next/server";
import { erpContext, erpRoute, json, type ErpCtx } from "@/lib/erp/auth";

type Params = Record<string, string>;
type Handler = (c: ErpCtx, req: NextRequest, params: Params) => Promise<unknown>;

// Rota que só lê: qualquer pessoa logada na empresa.
export const reader = (fn: Handler) =>
  erpRoute(async (req, ctx) => {
    const c = await erpContext();
    return json(await fn(c, req, await ctx.params));
  });

// Rota que grava: exige permissão de edição.
export const writer = (fn: Handler, status = 200) =>
  erpRoute(async (req, ctx) => {
    const c = await erpContext({ write: true });
    return json(await fn(c, req, await ctx.params), status);
  });

export const body = async (req: NextRequest): Promise<Record<string, unknown>> =>
  (await req.json().catch(() => ({}))) as Record<string, unknown>;

export const param = (req: NextRequest, name: string) => req.nextUrl.searchParams.get(name) ?? undefined;
