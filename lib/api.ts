import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/tenant";

// converte erros de acesso em respostas JSON com o status certo
export function route(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  };
}
