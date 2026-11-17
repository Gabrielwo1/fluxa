import { ExternalLink, Sparkles } from "lucide-react";
import { Panel } from "@/components/ui-kit";
import { PageHeader } from "@/components/erp/ui";
import { SUITE } from "@/lib/suite";

export default function ModulosPage() {
  return (
    <>
      <PageHeader
        title="Módulos da suíte"
        description="Três produtos que trabalham juntos: gestão, clientes novos e atendimento. Cada um tem o seu endereço; este é o ponto de partida."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {SUITE.map((m) => {
          const here = m.id === "fluxa";
          return (
            <Panel key={m.id} className="flex flex-col">
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.icon} alt="" className="h-12 w-12 rounded-full" />
                <div>
                  <h2 className="text-lg font-bold leading-tight">{m.name}</h2>
                  <p className="text-xs text-muted-foreground">{m.tagline}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{m.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {m.features.map((f) => <li key={f} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{f}</li>)}
              </ul>
              {m.soon && (
                <div className="mt-4 rounded-2xl border border-dashed p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles size={12} /> Em breve</p>
                  <ul className="space-y-1 text-sm">{m.soon.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              <div className="mt-auto pt-5">
                {here ? (
                  <span className="inline-flex rounded-full bg-primary/25 px-3 py-1.5 text-sm font-semibold">Você está aqui</span>
                ) : (
                  <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Abrir {m.name} <ExternalLink size={14} /></a>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
