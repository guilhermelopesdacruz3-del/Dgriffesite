// Análise focada: joias (peso/estoque/preço) + estoque geral das variações.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const wb = read(readFileSync(FILE));
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(sheet, { defval: null });

const norm = (v) => (v ?? "").toString().toLowerCase();
const isJewel = (r) =>
  /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/.test(
    norm(r["categoria-nome-nivel-2"]) + " " + norm(r["categoria-nome-nivel-3"]) + " " + norm(r["nome"])
  ) || norm(r["categoria-nome-nivel-1"]) === "joias";
const isGold = (r) =>
  isJewel(r) && (/ouro/.test(norm(r["nome"])) || /18k|750/.test(norm(r["grade-quilates-k"])) || /ouro/.test(norm(r["grade-quilates-k"])));
const isSilver = (r) => isJewel(r) && /prata|925/.test(norm(r["nome"]) + norm(r["grade-quilates-k"]));

const num = (v) => (v === null || v === "" ? null : Number(v));
const filled = (arr, get) => arr.filter((r) => get(r) !== null && !Number.isNaN(get(r))).length;
const sum = (arr, get) => arr.reduce((a, r) => a + (get(r) || 0), 0);

const jewels = rows.filter(isJewel);
const gold = rows.filter(isGold);
const silver = rows.filter(isSilver);

console.log("Total linhas:", rows.length);
console.log("Linhas de joias:", jewels.length, "| ouro:", gold.length, "| prata:", silver.length);

console.log("\n--- JOIAS DE OURO ---");
console.log("peso-em-kg preenchido:", filled(gold, (r) => num(r["peso-em-kg"])));
console.log("preco-cheio preenchido:", filled(gold, (r) => num(r["preco-cheio"])));
console.log("estoque-quantidade somado:", sum(gold, (r) => num(r["estoque-quantidade"])));
console.log("com estoque > 0:", gold.filter((r) => num(r["estoque-quantidade"]) > 0).length);
for (const r of gold.filter((r) => num(r["peso-em-kg"]) > 0).slice(0, 5)) {
  console.log(`• ${r["sku"]} ${r["nome"]} | peso: ${r["peso-em-kg"]}kg | preço: ${r["preco-cheio"]} | estoque: ${r["estoque-quantidade"]} | quilates: ${r["grade-quilates-k"]}`);
}

console.log("\n--- JOIAS DE PRATA ---");
console.log("peso preenchido:", filled(silver, (r) => num(r["peso-em-kg"])));
console.log("preco-cheio preenchido:", filled(silver, (r) => num(r["preco-cheio"])));
console.log("com estoque > 0:", silver.filter((r) => num(r["estoque-quantidade"]) > 0).length);
for (const r of silver.filter((r) => num(r["estoque-quantidade"]) > 0).slice(0, 5)) {
  console.log(`• ${r["sku"]} ${r["nome"]} | peso: ${r["peso-em-kg"]} | preço: ${r["preco-cheio"]} | estoque: ${r["estoque-quantidade"]}`);
}

// Não-joias: quantas variações têm estoque > 0 e preço?
const nonJewel = rows.filter((r) => !isJewel(r));
console.log("\n--- NÃO-JOIAS (armações, etc.) ---");
console.log("total:", nonJewel.length, "| estoque > 0:", nonJewel.filter((r) => num(r["estoque-quantidade"]) > 0).length, "| preço preenchido:", filled(nonJewel, (r) => num(r["preco-cheio"])));
