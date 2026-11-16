// Confirma estoque-gerenciado e faixa de preços das joias no xlsx.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const wb = read(readFileSync(FILE));
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const norm = (v) => (v ?? "").toString().toLowerCase();
const isJewel = (r) =>
  /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/.test(
    norm(r["categoria-nome-nivel-2"]) + " " + norm(r["categoria-nome-nivel-3"]) + " " + norm(r["nome"])
  ) || norm(r["categoria-nome-nivel-1"]) === "joias";
const num = (v) => (v === null || v === "" ? null : Number(v));

const jewels = rows.filter(isJewel);
const managedY = jewels.filter((r) => norm(r["estoque-gerenciado"]) === "y").length;
const managedN = jewels.filter((r) => norm(r["estoque-gerenciado"]) === "n").length;
console.log(`Joias: gerenciado Y=${managedY} N=${managedN}`);

const prices = jewels.map((r) => num(r["preco-cheio"])).filter((v) => v && v > 0).sort((a, b) => a - b);
const pct = (p) => prices[Math.floor(prices.length * p)];
console.log(`Preços de joias: n=${prices.length} | mín=${prices[0]} | 10%=${pct(0.1)} | mediana=${pct(0.5)} | 90%=${pct(0.9)} | máx=${prices.at(-1)}`);

// Amostra de corrente/colar de ouro com preço (modelo clássico da loja)
const goldByName = jewels.filter((r) => /ouro/.test(norm(r["nome"])) && num(r["preco-cheio"]) > 0);
console.log(`\nJoias com "ouro" no nome e preço > 0: ${goldByName.length}`);
for (const r of goldByName.slice(0, 8)) {
  console.log(`• ${r["sku"]} ${r["nome"]} → R$ ${r["preco-cheio"]} (ativo: ${r["ativo"]}, gerenciado: ${r["estoque-gerenciado"]})`);
}

// Como está o PROMOCIONAL vs CHEIO
const promo = jewels.filter((r) => num(r["preco-promocional"]) > 0 && num(r["preco-promocional"]) < num(r["preco-cheio"]));
console.log(`\nJoias com preço promocional diferente: ${promo.length}`);
