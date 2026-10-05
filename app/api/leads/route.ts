import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";

const FILE = path.join(process.cwd(), "data", "leads.json");

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // campo-armadilha preenchido = robô; responde como sucesso e descarta
  if (clip(body.website, 50)) return NextResponse.json({ ok: true });

  const name = clip(body.name, 120);
  const email = clip(body.email, 160);
  const company = clip(body.company, 160);
  if (!name || !company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  if (!body.consent) {
    return NextResponse.json({ error: "Consentimento obrigatório" }, { status: 400 });
  }

  const lead = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    name,
    email,
    company,
    role: clip(body.role, 120),
    phone: clip(body.phone, 30),
    size: clip(body.size, 80),
    pain: clip(body.pain, 600),
    consentAt: new Date().toISOString(),
    utm: {
      source: clip(body.utm_source, 120),
      medium: clip(body.utm_medium, 120),
      campaign: clip(body.utm_campaign, 120),
      content: clip(body.utm_content, 120),
      term: clip(body.utm_term, 120),
    },
  };

  if (supabaseConfigured) {
    // visitante anônimo: a política de RLS só permite inserir (nunca ler)
    const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await db.from("leads").insert({
      source: "lp",
      name: lead.name,
      email: lead.email,
      company: lead.company,
      role: lead.role || null,
      phone: lead.phone || null,
      size: lead.size || null,
      pain: lead.pain || null,
      consent_at: lead.consentAt,
      utm: lead.utm,
    });
    if (error) {
      console.error("leads insert", error.message);
      return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (process.env.VERCEL) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 503 });
  }

  let leads: unknown[] = [];
  try {
    leads = JSON.parse(await fs.readFile(FILE, "utf-8"));
    if (!Array.isArray(leads)) leads = [];
  } catch {
    leads = [];
  }
  leads.push(lead);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(leads, null, 2));

  return NextResponse.json({ ok: true });
}
