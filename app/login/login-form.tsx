"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import { formatAccessCodeInput } from "@/lib/access-code-format";
import { safeNext } from "@/lib/routes";
import { cn } from "@/lib/utils";

function CodeForm() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Digite o código de acesso.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/access/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Não foi possível entrar.");
      setBusy(false);
      return;
    }
    // navegação completa: garante que o painel já carregue com a sessão nova
    window.location.assign(safeNext(params.get("next")));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Código de acesso</span>
        <Input
          value={code}
          onChange={(e) =>
            setCode(/^flx/i.test(e.target.value) ? formatAccessCodeInput(e.target.value) : e.target.value)
          }
          placeholder="Digite o seu código"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          className="h-12 text-center text-base tracking-wide"
          aria-describedby="code-help"
        />
        <span id="code-help" className="mt-1.5 block text-xs text-muted-foreground">
          Enviado pela equipe da Fluxa. Cada código é pessoal.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
        {busy ? <Loader2 size={16} className="animate-spin" /> : "Entrar com o código"}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError("E-mail ou senha incorretos.");
      setBusy(false);
      return;
    }
    window.location.assign(safeNext(params.get("next")));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">E-mail</span>
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Senha</span>
        <Input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
        {busy ? <Loader2 size={16} className="animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

export function LoginForm({ supabase, mvp }: { supabase: boolean; mvp: boolean }) {
  const [mode, setMode] = useState<"code" | "password">("code");

  if (!supabase && !mvp) {
    return (
      <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        O Supabase ainda não está configurado neste ambiente, então o painel
        roda em modo local, sem login.{" "}
        <Link href="/" className="font-medium text-foreground underline">
          Abrir o painel
        </Link>
      </p>
    );
  }

  if (!supabase) return <CodeForm />;

  return (
    <>
      <div role="tablist" aria-label="Forma de entrar" className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
        {(
          [
            ["code", "Código de acesso", KeyRound],
            ["password", "E-mail e senha", Mail],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
              mode === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
      {mode === "code" ? <CodeForm /> : <PasswordForm />}
    </>
  );
}
