import { NextResponse } from "next/server";
import { route } from "@/lib/api";

// CDI anualizado (série 4389 do Banco Central), para pré-preencher as projeções.
export const GET = route(async () => {
  try {
    const res = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json",
      { next: { revalidate: 6 * 60 * 60 } }
    );
    if (!res.ok) throw new Error(String(res.status));
    const [last] = (await res.json()) as { data: string; valor: string }[];
    const cdi = Number(last.valor);
    if (!Number.isFinite(cdi)) throw new Error("valor inválido");
    const [d, m, y] = last.data.split("/");
    return NextResponse.json({ cdi, date: `${y}-${m}-${d}` });
  } catch {
    return NextResponse.json({ cdi: null, date: null });
  }
});
