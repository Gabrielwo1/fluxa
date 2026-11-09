"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { useApi } from "@/lib/erp/client";
import { LoadingRows } from "@/components/erp/ui";

export type ErpStatus = { configured: boolean; canWrite: boolean; company: string };

// Envolve as telas do ERP: se o banco ainda não foi ligado neste ambiente, explica o que fazer.
// redirectIfOff: sem banco, leva para outra página em vez de mostrar o aviso (usado no Início,
// para quem ainda usa só o painel bancário continuar caindo nele até o banco ser ligado).
export function ErpGate({ children, redirectIfOff }: { children: (status: ErpStatus) => React.ReactNode; redirectIfOff?: string }) {
  const router = useRouter();
  const { data, error } = useApi<ErpStatus>("/api/erp/status");
  const off = data ? !data.configured : false;
  useEffect(() => {
    if (off && redirectIfOff) router.replace(redirectIfOff);
  }, [off, redirectIfOff, router]);
  if (error) {
    return (
      <Panel>
        <p className="text-sm text-destructive">{error}</p>
      </Panel>
    );
  }
  if (!data) return <LoadingRows rows={4} />;
  if (!data.configured) {
    if (redirectIfOff) return <LoadingRows rows={4} />;
    return (
      <Panel className="mx-auto mt-6 max-w-2xl p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
          <Database size={26} />
        </span>
        <h2 className="text-xl font-bold">Falta ligar o banco de dados</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O ERP guarda clientes, produtos, vendas e contas num banco Postgres. Neste ambiente ele ainda não foi conectado.
          Quem administra o sistema precisa definir a variável <code className="rounded bg-muted px-1.5 py-0.5">DATABASE_URL</code> e
          rodar <code className="rounded bg-muted px-1.5 py-0.5">npm run erp:migrate</code>. O passo a passo está em docs/ERP.md.
        </p>
      </Panel>
    );
  }
  return <>{children(data)}</>;
}
