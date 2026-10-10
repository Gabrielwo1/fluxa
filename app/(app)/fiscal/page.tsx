"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Check, FileKey, KeyRound, Loader2, Upload } from "lucide-react";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatarCnae } from "@/lib/cnae";
import {
  CertificadoInaptoError,
  cadastrarEmitente,
  carregarEmitente,
  consultarCnpjPublico,
  fmtDoc,
  importarHistorico,
  mascararCnpj,
  salvarConexao,
  type Emitente,
  type ModoAcesso,
  type ResultadoImportacao,
} from "@/lib/nfse-client";
import type { Aptidao } from "@/lib/nfse/aptidao";

/**
 * Configuração fiscal do cliente: qual é o CNPJ que emite e como ele fala com o governo.
 * No app antigo isso era um passo a passo de tela cheia; aqui vira uma página do painel,
 * porque quem usa o Fluxa já está dentro de um cliente e configura uma vez só.
 */

const ACESSOS: { modo: ModoAcesso & string; titulo: string; resumo: string; Icone: typeof KeyRound }[] = [
  {
    modo: "portal",
    titulo: "MEI / Portal",
    resumo: "Senha própria do nfse.gov.br, criada no primeiro acesso. Sem custo e sem certificado.",
    Icone: Building2,
  },
  {
    modo: "sefin",
    titulo: "A1 (arquivo)",
    resumo: "Certificado digital em arquivo .pfx. Conexão oficial e mais estável.",
    Icone: FileKey,
  },
  {
    modo: "a3",
    titulo: "A3 (token)",
    resumo: "Certificado em token ou cartão. Precisa de um passo a mais para funcionar aqui.",
    Icone: KeyRound,
  },
];

export default function FiscalPage() {
  const [emitente, setEmitente] = useState<Emitente | null | undefined>(undefined);

  // Carrega uma vez ao abrir; as partes de baixo chamam recarregar() depois de gravar algo.
  useEffect(() => {
    carregarEmitente().then(setEmitente);
  }, []);
  const recarregar = useCallback(() => {
    carregarEmitente().then(setEmitente);
  }, []);

  if (emitente === undefined) return null;

  return (
    <>
      <PageTitle
        title="Configuração fiscal"
        subtitle="O CNPJ que emite as notas deste cliente e como ele fala com o Sistema Nacional da NFS-e."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CadastroCnpj emitente={emitente} onSalvar={setEmitente} />
        {emitente && <Conexao emitente={emitente} onAtualizar={recarregar} />}
        {emitente && <Atividades emitente={emitente} />}
        {emitente && <Importacao emitente={emitente} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- CNPJ */

function CadastroCnpj({
  emitente,
  onSalvar,
}: {
  emitente: Emitente | null;
  onSalvar: (e: Emitente) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof consultarCnpjPublico>> | null>(null);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const jaBuscado = useRef("");

  const buscar = useCallback(async (doc: string) => {
    setErro("");
    setPrevia(null);
    setBuscando(true);
    try {
      const d = await consultarCnpjPublico(doc);
      if (jaBuscado.current !== doc) return;
      setPrevia(d);
      setEmail(d.email ?? "");
    } catch (e) {
      if (jaBuscado.current === doc) setErro((e as Error).message);
    } finally {
      if (jaBuscado.current === doc) setBuscando(false);
    }
  }, []);

  // Assim que os 14 dígitos ficam completos a consulta sai sozinha: ninguém aperta "buscar".
  function digitar(valor: string) {
    const texto = mascararCnpj(valor);
    const digitos = texto.replace(/\D/g, "");
    setCnpj(texto);
    if (digitos === jaBuscado.current) return;
    setPrevia(null);
    setErro("");
    setBuscando(false);
    if (digitos.length < 14) {
      jaBuscado.current = "";
      return;
    }
    jaBuscado.current = digitos;
    buscar(digitos);
  }

  async function salvar() {
    if (!previa) return;
    setSalvando(true);
    setErro("");
    try {
      onSalvar(await cadastrarEmitente(previa.cnpj, email.trim() || undefined));
      setPrevia(null);
      setCnpj("");
      jaBuscado.current = "";
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (emitente) {
    return (
      <Panel>
        <PanelHeader
          title="Emitente"
          subtitle="Dados buscados na Receita Federal."
          right={<Badge variant="outline">{emitente.regime}</Badge>}
        />
        <p className="text-sm font-medium">{emitente.razaoSocial}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{fmtDoc(emitente.cnpj)}</p>
        <dl className="mt-4 divide-y text-sm">
          <Linha rotulo="Cidade" valor={emitente.municipioNome ? `${emitente.municipioNome}/${emitente.uf}` : emitente.codigoMunicipio} />
          <Linha rotulo="E-mail na nota" valor={emitente.email ?? "—"} />
          <Linha rotulo="Série do DPS" valor={String(emitente.serie)} />
        </dl>
        {emitente.avisoMunicipio && emitente.avisoMunicipio.tipo === "sistema-proprio" && (
          <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
            {emitente.avisoMunicipio.municipio} ainda usa o sistema próprio da prefeitura. Fora do MEI, a nota
            dessa cidade é emitida lá, e o app não consegue emitir por ela.
          </p>
        )}
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader title="Comece pelo CNPJ" subtitle="Digite os 14 números: o resto vem da Receita Federal." />
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>CNPJ</span>
          <span className="tabular-nums">{cnpj.replace(/\D/g, "").length}/14</span>
        </span>
        <Input
          value={cnpj}
          onChange={(e) => digitar(e.target.value)}
          placeholder="00.000.000/0001-00"
          inputMode="numeric"
          maxLength={18}
          className="tabular-nums"
        />
      </label>

      {buscando && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Consultando a Receita Federal…
        </p>
      )}
      {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}

      {previa && (
        <div className="mt-4 rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{previa.razaoSocial}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{fmtDoc(previa.cnpj)}</p>
            </div>
            <Badge variant={previa.opcaoMei ? "default" : "outline"}>
              {previa.opcaoMei ? "MEI" : previa.opcaoSimples ? "Simples" : "Fora do Simples"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {previa.cnaes[0]?.descricao} · {previa.endereco.municipio}/{previa.endereco.uf}
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs text-muted-foreground">E-mail que vai nas notas</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com.br" type="email" />
          </label>
          <Button className="mt-4 w-full" onClick={salvar} disabled={salvando}>
            {salvando ? "Confirmando na Receita…" : "Confirmar e salvar"}
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}

/* ---------------------------------------------------------- conexão */

function Conexao({ emitente, onAtualizar }: { emitente: Emitente; onAtualizar: () => void }) {
  const [modo, setModo] = useState<ModoAcesso>(emitente.modoEmissao === "simulacao" ? "portal" : emitente.modoEmissao);
  const [ambiente, setAmbiente] = useState(emitente.ambiente);
  const [loginPortal, setLoginPortal] = useState(fmtDoc(emitente.cnpj));
  const [senhaPortal, setSenhaPortal] = useState("");
  const [pfx, setPfx] = useState("");
  const [pfxNome, setPfxNome] = useState("");
  const [senhaPfx, setSenhaPfx] = useState("");
  const [serieA3, setSerieA3] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [inapto, setInapto] = useState<Aptidao | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const serieLimpa = serieA3.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  const pode =
    modo === "portal"
      ? loginPortal.replace(/\D/g, "").length >= 11 && senhaPortal.length > 0
      : modo === "sefin"
        ? Boolean(pfx && senhaPfx)
        : serieLimpa.length >= 4;

  function lerPfx(f: File | undefined) {
    if (!f) return;
    setPfxNome(f.name);
    const fr = new FileReader();
    fr.onload = () => setPfx((fr.result as string).split(",")[1] ?? "");
    fr.readAsDataURL(f);
  }

  async function conectar() {
    setSalvando(true);
    setErro("");
    setMsg("");
    setInapto(null);
    try {
      await salvarConexao({
        modo,
        ambiente,
        loginPortal: loginPortal.replace(/\D/g, ""),
        senhaPortal,
        pfxBase64: pfx,
        senhaPfx,
        serieA3: serieLimpa,
      });
      setSenhaPortal("");
      setSenhaPfx("");
      setPfx("");
      setMsg(modo === "a3" ? "Certificado A3 guardado." : "Conta conectada.");
      onAtualizar();
    } catch (e) {
      if (e instanceof CertificadoInaptoError) setInapto(e.aptidao);
      else setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const ROTULO: Record<string, string> = {
    simulacao: "Simulação",
    portal: "MEI / Portal",
    sefin: "A1 (arquivo)",
    a3: "A3 (token)",
  };

  return (
    <Panel>
      <PanelHeader
        title="Acesso ao governo"
        subtitle="É o que permite emitir de verdade e trazer o histórico."
        right={<Badge variant="outline">{ROTULO[emitente.modoEmissao]}</Badge>}
      />

      <div className="grid grid-cols-3 gap-2">
        {ACESSOS.map((a) => {
          const ativo = modo === a.modo;
          return (
            <button
              key={a.modo}
              type="button"
              onClick={() => setModo(a.modo)}
              aria-pressed={ativo}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition ${
                ativo ? "border-primary bg-primary/5" : "hover:bg-muted"
              }`}
            >
              <a.Icone className={`size-5 ${ativo ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-xs font-medium ${ativo ? "text-primary" : ""}`}>{a.titulo}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{ACESSOS.find((a) => a.modo === modo)?.resumo}</p>

      <div className="mt-4 space-y-3">
        {modo === "portal" && (
          <>
            <Campo rotulo="CNPJ de acesso">
              <Input value={loginPortal} onChange={(e) => setLoginPortal(e.target.value)} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Senha do Emissor Nacional">
              <Input
                type="password"
                value={senhaPortal}
                onChange={(e) => setSenhaPortal(e.target.value)}
                placeholder="A senha que você criou no portal"
              />
            </Campo>
            <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Guardamos a senha cifrada e usamos só para emitir e consultar em seu nome.
            </p>
          </>
        )}

        {modo === "sefin" && (
          <>
            <Campo rotulo="Arquivo .pfx do certificado">
              <Button variant="outline" className="w-full justify-start" onClick={() => arquivoRef.current?.click()}>
                {pfxNome || "Escolher arquivo"}
              </Button>
              <input
                ref={arquivoRef}
                type="file"
                accept=".pfx,.p12"
                hidden
                onChange={(e) => lerPfx(e.target.files?.[0])}
              />
            </Campo>
            <Campo rotulo="Senha do certificado">
              <Input type="password" value={senhaPfx} onChange={(e) => setSenhaPfx(e.target.value)} />
            </Campo>
            <Campo rotulo="Ambiente">
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as typeof ambiente)}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="producao">Produção, a nota vale de verdade</option>
                <option value="homologacao">Homologação, só para testes</option>
              </select>
            </Campo>
          </>
        )}

        {modo === "a3" && (
          <>
            <Campo rotulo="Número de série do certificado">
              <Input
                value={serieA3}
                onChange={(e) => setSerieA3(e.target.value)}
                placeholder="Ex: 1234567890ABCDEF"
                className="font-mono"
              />
            </Campo>
            <p className="text-xs text-muted-foreground">
              Encontre no gerenciador de certificados do seu computador. Pode colar com espaços.
            </p>
            <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              A chave do A3 fica trancada no token e só assina na sua máquina, então a emissão por aqui ainda
              não funciona com ele. Guardamos a série para identificar o certificado. Para emitir hoje, use a
              senha do Emissor Nacional ou um A1.
            </p>
          </>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Entra no nfse.gov.br pelo gov.br?</strong> Então ainda falta criar o
        acesso do Emissor Nacional: o gov.br não funciona aqui dentro porque o portal tem registro próprio no
        Login Único.{" "}
        <a
          className="font-medium text-primary underline underline-offset-4"
          href="https://www.nfse.gov.br/EmissorNacional/Acesso/PrimeiroAcesso"
          target="_blank"
          rel="noopener noreferrer"
        >
          Criar acesso
        </a>
      </div>

      {inapto && (
        <div className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <p className="font-medium">Esse certificado não vai conseguir emitir</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {inapto.problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}
      {msg && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="size-3.5" /> {msg}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={conectar} disabled={!pode || salvando}>
        {salvando ? "Salvando…" : modo === "a3" ? "Salvar certificado A3" : "Conectar"}
      </Button>
    </Panel>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------- atividades */

function Atividades({ emitente }: { emitente: Emitente }) {
  const cnaes = emitente.cnaes ?? [];
  if (!cnaes.length) return null;
  return (
    <Panel>
      <PanelHeader
        title="Atividades do CNPJ"
        subtitle="Usamos para sugerir o código de serviço certo em cada nota."
      />
      <ul className="space-y-2 text-sm">
        {cnaes.map((c, i) => (
          <li key={c.codigo} className="flex gap-2">
            <span className="tabular-nums text-muted-foreground">{formatarCnae(c.codigo)}</span>
            <span className="min-w-0 flex-1">{c.descricao}</span>
            {i === 0 && <Badge variant="secondary">principal</Badge>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* -------------------------------------------------------- histórico */

function Importacao({ emitente }: { emitente: Emitente }) {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  async function importar(arquivos?: string[]) {
    setRodando(true);
    setErro("");
    setResultado(null);
    try {
      setResultado(await importarHistorico(arquivos));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setRodando(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Histórico de notas"
        subtitle="Traz o que já foi emitido antes, para o faturamento e o limite do MEI nascerem certos."
        right={
          emitente.importadoEm ? (
            <span className="text-xs text-muted-foreground">
              última em {new Date(emitente.importadoEm).toLocaleDateString("pt-BR")}
            </span>
          ) : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => importar()} disabled={rodando}>
          {rodando ? <Loader2 className="animate-spin" /> : null}
          {rodando ? "Buscando…" : "Buscar no governo"}
        </Button>
        <Button variant="outline" onClick={() => arquivoRef.current?.click()} disabled={rodando}>
          <Upload /> Enviar XML
        </Button>
        <input
          ref={arquivoRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          hidden
          onChange={async (e) => {
            const lista = e.target.files;
            e.target.value = "";
            if (!lista?.length) return;
            importar(await Promise.all(Array.from(lista).map((f) => f.text())));
          }}
        />
      </div>

      {resultado && (
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>{resultado.importadas} notas trazidas</li>
          {resultado.duplicadas > 0 && <li>{resultado.duplicadas} já estavam aqui</li>}
          {resultado.recebidas > 0 && <li>{resultado.recebidas} recebidas, que não entram no faturamento</li>}
          {resultado.ilegiveis > 0 && <li>{resultado.ilegiveis} arquivos ilegíveis</li>}
          {resultado.aviso && <li className="text-foreground">{resultado.aviso}</li>}
        </ul>
      )}
      {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}
    </Panel>
  );
}
