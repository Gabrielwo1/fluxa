import assert from "assert";
import { _CORRELACAO, codigosDoCnae, servicosCompativeis, codigoCompativel, formatarCnae } from "../lib/cnae";
import { servicoPorCodigo, buscarServicos, SERVICOS } from "../lib/servicos";

// 1. Todo código da correlação precisa existir na lista oficial. É isso que impede código inventado.
const invalidos = Object.entries(_CORRELACAO).flatMap(([cnae, cods]) => cods.filter((c) => !servicoPorCodigo(c)).map((c) => `${cnae}->${c}`));
assert.deepEqual(invalidos, [], `códigos fora da lista oficial: ${invalidos.join(", ")}`);

// 2. Chaves são prefixos numéricos de 2 a 7 dígitos.
for (const k of Object.keys(_CORRELACAO)) assert.match(k, /^\d{2,7}$/, `chave inválida ${k}`);

assert.equal(SERVICOS.length, 338, "lista oficial completa");
assert.equal(servicoPorCodigo("071002")?.descricao.startsWith("Limpeza, manutenção e conservação de imóveis"), true, "limpeza de imóveis é 071002, não 071001");

// 3. O prefixo mais específico vence.
assert.deepEqual(codigosDoCnae("9602501"), ["060101"], "cabeleireiro");
assert.deepEqual(codigosDoCnae("9602502"), ["060201"], "estética");
assert.deepEqual(codigosDoCnae("4330404"), ["070501"], "pintura vence a divisão 43");
assert.deepEqual(codigosDoCnae("4399103"), ["070202", "070201"], "alvenaria cai na divisão 43");
assert.deepEqual(codigosDoCnae("6201-5/01"), ["010101", "010401", "010201", "010801"], "aceita CNAE formatado");
assert.ok(codigosDoCnae("6201501").includes("010801"), "desenvolvedor que cria site não recebe alerta de atividade incompatível");
assert.deepEqual(codigosDoCnae("4711302"), [], "comércio varejista não é serviço");

// 4. Principal primeiro, sem duplicar.
const s = servicosCompativeis([
  { codigo: "7319003", descricao: "Marketing direto" },
  { codigo: "7311400", descricao: "Agências de publicidade" },
  { codigo: "7420001", descricao: "Fotografia" },
]);
assert.equal(s[0].codigo, "170601");
assert.equal(s[0].principal, true);
assert.equal(s.filter((x) => x.codigo === "170601").length, 1, "sem repetição");
assert.ok(s.some((x) => x.codigo === "130301" && !x.principal));

assert.equal(codigoCompativel("060101", [{ codigo: "9602501", descricao: "" }]), true);
assert.equal(codigoCompativel("010101", [{ codigo: "9602501", descricao: "" }]), false);
assert.equal(codigoCompativel("010101", []), null, "sem CNAE não dá para julgar");
assert.equal(formatarCnae("9602501"), "9602-5/01");

// 5. A preferência pelo CNAE muda a ordem da busca.
const semPref = buscarServicos("limpeza", 5);
const comPref = buscarServicos("limpeza", 5, ["060201"]);
assert.equal(comPref[0].codigo, "060201", "esteticista que digita limpeza quer limpeza de pele");
assert.notEqual(semPref[0].codigo, undefined);

assert.equal(buscarServicos("instalação de rede e configuração de roteador")[0].codigo, "010701", "rede de computadores é suporte em informática, não obra elétrica");

console.log(`cnae OK (${Object.keys(_CORRELACAO).length} prefixos, todos com código oficial)`);
