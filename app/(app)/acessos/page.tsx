"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Code = {
  id: string;
  public_id: string;
  label: string | null;
  role: "owner" | "editor" | "viewer";
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
};

const ROLES = [
  ["viewer", "Somente leitura"],
  ["editor", "Edita (contas fixas, categorias, bancos)"],
  ["owner", "Responsável"],
] as const;

const VALIDITY = [
  [0, "Sem validade"],
  [7, "7 dias"],
  [30, "30 dias"],
  [90, "90 dias"],
  [365, "1 ano"],
] as const;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Erro ${res.status}`);
  return json as T;
}

export default function AccessPage() {
  const { ready, me } = useFinance();
  const [codes, setCodes] = useState<Code[]>([]);
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number][0]>("viewer");
  const [days, setDays] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(0);

  const enabled = ready && me?.mode === "supabase" && me.isStaff;

  // recarrega ao trocar de cliente e depois de gerar ou revogar (tick)
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    call<{ codes: Code[] }>("/api/access-codes")
      .then((data) => {
        if (!active) return;
        setCodes(data.codes);
        setNow(Date.now());
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [enabled, me?.client.id, tick]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFresh(null);
    try {
      const data = await call<{ code: string }>("/api/access-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, role, days }),
      });
      setFresh(data.code);
      setLabel("");
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(c: Code) {
    if (!window.confirm(`Revogar o acesso ${c.label ? `“${c.label}”` : `FLX-${c.public_id.toUpperCase()}`}? Quem usa esse código perde o acesso na hora.`)) {
      return;
    }
    try {
      await call("/api/access-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id }),
      });
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // sem permissão de área de transferência: o código continua visível para copiar à mão
    }
  }

  if (!ready) return null;

  if (!enabled) {
    return (
      <>
        <PageTitle title="Acessos" />
        <Panel>
          <p className="text-sm text-muted-foreground">
            {me?.mode === "local"
              ? "Os acessos por código dependem do Supabase configurado."
              : "Apenas a equipe gerencia os acessos dos clientes."}
          </p>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Acessos por código"
        subtitle={`Quem entra no painel de ${me?.client.name}. Cada código é pessoal e pode ser revogado.`}
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel>
          <PanelHeader title="Gerar novo código" subtitle="O código aparece uma única vez." />
          <form onSubmit={generate} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Quem vai usar</span>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex.: Diretora financeira"
                maxLength={120}
                className="h-11"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Permissão</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary"
              >
                {ROLES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Validade</span>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary"
              >
                {VALIDITY.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Gerar código
            </Button>
          </form>

          {fresh && (
            <div className="mt-5 rounded-2xl border-2 border-primary bg-primary/15 p-4" role="status">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Código gerado
              </p>
              <p className="mt-1 break-all font-mono text-xl font-bold tracking-wider">{fresh}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={copy} className="rounded-full">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Ele não fica salvo em lugar nenhum: se perder, é preciso gerar outro. Envie por
                um canal seguro e só para quem vai usar.
              </p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Acessos ativos" subtitle={`${codes.length} ${codes.length === 1 ? "código" : "códigos"}`} />
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum código gerado para este cliente ainda.</p>
          ) : (
            <ul className="divide-y">
              {codes.map((c) => {
                const expired = c.expires_at ? new Date(c.expires_at).getTime() < now : false;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.label || "Sem identificação"}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          FLX-{c.public_id.toUpperCase()}-····
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ROLES.find(([v]) => v === c.role)?.[1]} · criado em {fmt(c.created_at)} ·
                        último uso {fmt(c.last_used_at)}
                        {c.expires_at && ` · ${expired ? "expirou" : "vale até"} ${fmt(c.expires_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          expired ? "bg-bad/15 text-bad" : "bg-primary/25"
                        )}
                      >
                        {expired ? "expirado" : "ativo"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => revoke(c)}
                        aria-label={`Revogar o acesso ${c.label ?? c.public_id}`}
                      >
                        <Trash2 size={13} /> Revogar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
