// Inspeciona o xlsx de estoque: colunas, amostras de linhas e cobertura.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const wb = read(readFileSync(FILE));
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(sheet, { defval: null });

console.log("Colunas:", Object.keys(rows[0]).join(" | "));

// Amostras: 3 linhas de joia de ouro (se houver), 3 de armação de grau
const sample = (pred, label) => {
  const found = rows.filter(pred).slice(0, 3);
  console.log(`\n--- ${label} (${found.length} amostras de ${rows.filter(pred).length} linhas) ---`);
  for (const r of found) console.log(JSON.stringify(r, null, 1).slice(0, 900));
};

const isGoldJewel = (r) =>
  JSON.stringify(Object.values(r)).toLowerCase().includes("ouro") &&
  !JSON.stringify(Object.values(r)).toLowerCase().includes("banhado");

sample(isGoldJewel, "Joia de ouro");

// Cobertura das colunas-chave
const cols = Object.keys(rows[0]);
const coverage = {};
for (const c of cols) {
  const filled = rows.filter((r) => r[c] !== null && r[c] !== "" && r[c] !== undefined).length;
  coverage[c] = filled;
}
console.log("\n--- Preenchimento por coluna (de", rows.length, "linhas) ---");
for (const [c, n] of Object.entries(coverage)) console.log(`${c}: ${n}`);
