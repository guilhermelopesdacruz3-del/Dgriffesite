// Checa estoque-gerenciado e estoque das LINHAS DE ÓCULOS no arquivo.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const wb = read(readFileSync(FILE));
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const norm = (v) => (v ?? "").toString().toLowerCase();
const JOIA_RE = /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/;
const isJewelRow = (r) =>
  JOIA_RE.test(norm(r["nome"]) + " " + norm(r["categoria-nome-nivel-1"]) + " " + norm(r["categoria-nome-nivel-2"]) + " " + norm(r["categoria-nome-nivel-3"])) ||
  norm(r["categoria-nome-nivel-1"]) === "joias";

const oculos = rows.filter((r) => !isJewelRow(r));
const num = (v) => Number(v) || 0;

const gY = oculos.filter((r) => norm(r["estoque-gerenciado"]) === "y");
const gN = oculos.filter((r) => norm(r["estoque-gerenciado"]) === "n");
console.log(`Linhas de óculos: ${oculos.length}`);
console.log(`  gerenciado=S: ${gY.length} | gerenciado=N: ${gN.length}`);
console.log(`  gerenciado=S com estoque>0: ${gY.filter((r) => num(r["estoque-quantidade"]) > 0).length}`);
console.log(`  gerenciado=S com estoque=0: ${gY.filter((r) => num(r["estoque-quantidade"]) === 0).length}`);
console.log(`  gerenciado=N com estoque>0: ${gN.filter((r) => num(r["estoque-quantidade"]) > 0).length}`);

// Ativos nas duas situações
const ativos = oculos.filter((r) => norm(r["ativo"]) === "s");
console.log(`\nAtivos: ${ativos.length}`);
console.log(`  ativos gerenciado=S estoque=0: ${ativos.filter((r) => norm(r["estoque-gerenciado"]) === "s" && num(r["estoque-quantidade"]) === 0).length}`);
console.log(`  ativos gerenciado=S estoque>0: ${ativos.filter((r) => norm(r["estoque-gerenciado"]) === "s" && num(r["estoque-quantidade"]) > 0).length}`);
console.log(`  ativos gerenciado=N: ${ativos.filter((r) => norm(r["estoque-gerenciado"]) === "n").length}`);
