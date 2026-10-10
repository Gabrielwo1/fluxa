import { calcularResumo, ultimosMeses, LIMITE_MEI_ANUAL } from "../lib/financeiro";
import assert from "assert";

const hoje = new Date("2026-09-09T12:00:00-03:00");
const meses = ultimosMeses(12, hoje);
assert.deepEqual([meses[0], meses[11]], ["2025-10", "2026-09"], "janela de 12 meses");

const r = calcularResumo(
  [
    { valor: 1000, competencia: "2026-09-01", status: "emitida", tomadorNome: "A" },
    { valor: 500, competencia: "2026-08-15", status: "registrada", tomadorNome: "B" },
    { valor: 99999, competencia: "2026-07-01", status: "simulada", tomadorNome: "A" }, // não conta
    { valor: 300, competencia: "2026-07-01", status: "cancelada", tomadorNome: "A" }, // não conta
    { valor: 200, competencia: "2026-09-02", status: "processando", tomadorNome: "C" }, // pendente
    { valor: 700, competencia: "2025-12-01", status: "emitida", tomadorNome: "A" }, // ano passado
  ],
  "MEI",
  hoje,
);
assert.equal(r.anoAtual, 1500, "só emitidas/registradas do ano");
assert.equal(r.mesAtual, 1000);
assert.equal(r.pendentes, 1);
assert.equal(r.totalNotas, 3);
assert.equal(r.mediaMensal, (1000 + 500 + 700) / 3);
assert.equal(r.limiteAnual, LIMITE_MEI_ANUAL);
assert.equal(r.topClientes[0].nome, "A");
assert.equal(r.meses.find((m) => m.mes === "2025-12")?.total, 700);
assert.equal(calcularResumo([], "SIMPLES", hoje).limiteAnual, 0);
console.log("financeiro OK");
