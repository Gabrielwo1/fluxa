"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/site/site-header";
import { createClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/config";

// só aceita caminhos internos como destino depois do login
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function LoginForm() {
  const router = useRouter();
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
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  if (!supabaseConfigured) {
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

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-sm">
        <BrandMark className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Entrar no painel</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Acesso exclusivo para clientes e equipe.
        </p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
