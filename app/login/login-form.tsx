"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatAccessCodeInput } from "@/lib/access-code-format";
import { safeNext } from "@/lib/routes";
import { BRAND, WHATSAPP } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Campo em pílula com ícone, como no login do Radar.
function Campo({ icon, label, extra, children }: { icon: React.ReactNode; label: string; extra?: React.ReactNode; children: React.ReactElement }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-ink/60">{label}</span>
      <span className="flex h-12 items-center gap-3 rounded-full border border-white bg-white/80 px-4 focus-within:ring-2 focus-within:ring-ink/15 [&_input]:h-full [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm [&_input]:outline-none [&_input]:placeholder:text-ink/35">
        <span className="text-ink/40">{icon}</span>
        {children}
        {extra}
      </span>
    </label>
  );
}

// Botão principal: texto à esquerda e seta em limão à direita.
function Enviar({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 flex h-12 w-full items-center justify-between rounded-full bg-ink pl-5 pr-1.5 text-sm font-medium text-white transition hover:bg-coal-2 disabled:opacity-60"
    >
      {children}
      <span className="grid size-9 place-items-center rounded-full bg-lime text-ink">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      </span>
    </button>
  );
}

const Erro = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
    {children}
  </p>
);

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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Campo icon={<KeyRound className="size-4" />} label="Código de acesso">
        <input
          value={code}
          onChange={(e) => setCode(/^flx/i.test(e.target.value) ? formatAccessCodeInput(e.target.value) : e.target.value)}
          placeholder="Digite o seu código"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
        />
      </Campo>
      <p className="-mt-1 px-2 text-xs text-ink/50">Enviado pela equipe do {BRAND.name}. Cada código é pessoal.</p>
      {error && <Erro>{error}</Erro>}
      <Enviar busy={busy}>Entrar com o código</Enviar>
    </form>
  );
}

function PasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("E-mail ou senha incorretos.");
      setBusy(false);
      return;
    }
    window.location.assign(safeNext(params.get("next")));
  }

  // as contas são criadas pela equipe: quem esqueceu a senha pede uma nova pelo WhatsApp
  const forgot = WHATSAPP
    ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá! Esqueci minha senha do ${BRAND.name}.${email.trim() ? ` Meu e-mail: ${email.trim()}` : ""}`)}`
    : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Campo icon={<Mail className="size-4" />} label="E-mail">
        <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
      </Campo>
      <Campo
        icon={<Lock className="size-4" />}
        label="Senha"
        extra={
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="text-ink/40 hover:text-ink">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      >
        <input required type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
      </Campo>
      {error && <Erro>{error}</Erro>}
      <Enviar busy={busy}>Entrar</Enviar>
      <p className="text-center text-sm text-ink/60">
        {forgot ? (
          <a href={forgot} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
            Esqueci minha senha
          </a>
        ) : (
          "Esqueceu a senha? Peça uma nova à equipe."
        )}
      </p>
    </form>
  );
}

export function LoginForm({ supabase, mvp }: { supabase: boolean; mvp: boolean }) {
  const [mode, setMode] = useState<"code" | "password">("code");

  if (!supabase && !mvp) {
    return (
      <p className="rounded-2xl border border-dashed border-ink/20 p-4 text-sm text-muted-foreground">
        O login ainda não está configurado neste ambiente, então o painel roda em modo local, sem login.{" "}
        <Link href="/" className="font-medium text-foreground underline">
          Abrir o painel
        </Link>
      </p>
    );
  }

  const form = !supabase ? <CodeForm /> : mode === "code" ? <CodeForm /> : <PasswordForm />;

  return (
    <>
      {supabase && (
        <div role="tablist" aria-label="Forma de entrar" className="mb-6 flex rounded-full bg-ink p-1">
          {(
            [
              ["code", "Código de acesso"],
              ["password", "E-mail e senha"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn("h-10 flex-1 rounded-full text-sm transition", mode === id ? "bg-lime font-medium text-ink" : "text-white/70 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {form}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-ink/10 pt-5 text-sm text-ink/60">
        <Link href="/demo" className="hover:text-ink hover:underline">
          Testar a demonstração
        </Link>
        {WHATSAPP && (
          <a
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá! Quero saber mais sobre o ${BRAND.name}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-ink hover:underline"
          >
            <MessageCircle className="size-4" /> Falar com a equipe
          </a>
        )}
      </div>
    </>
  );
}
