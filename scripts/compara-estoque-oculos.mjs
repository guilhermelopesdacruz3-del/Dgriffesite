// Compara estoque de óculos (não-joias): arquivo xlsx vs banco.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const p = new PrismaClient();
const norm = (v) => (v ?? "").toString().toLowerCase();
const JOIA_RE = /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/;

// 1) Estoque do arquivo por SKU
const wb = read(readFileSync(FILE));
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const isJewelRow = (r) =>
  JOIA_RE.test(norm(r["nome"]) + " " + norm(r["categoria-nome-nivel-1"]) + " " + norm(r["categoria-nome-nivel-2"]) + " " + norm(r["categoria-nome-nivel-3"])) ||
  norm(r["categoria-nome-nivel-1"]) === "joias";
const fileStock = new Map();
for (const r of rows) {
  if (isJewelRow(r)) continue;
  fileStock.set(String(r["sku"]).trim(), Number(r["estoque-quantidade"]) || 0);
}

// 2) Estoque do banco por SKU de variação
const products = await p.product.findMany({
  where: { type: { in: ["FRAMES", "SUNGLASSES"] } },
  select: { sku: true, name: true, active: true, variants: { select: { sku: true, stock: true, active: true } } },
});

let produtosComEstoque = 0, produtosSemEstoque = 0;
let variantsOk = 0, variantsDivergentes = 0, variantsSemMatch = 0;
const divergencias = [];

for (const prod of products) {
  // produto simples (1 variação com o sku do produto) vs com variações
  const total = prod.variants.filter((v) => v.active).reduce((a, v) => a + Math.max(0, v.stock), 0);
  if (total > 0) produtosComEstoque++; else produtosSemEstoque++;

  for (const v of prod.variants.filter((v) => v.active)) {
    if (!fileStock.has(v.sku)) {
      // tentar pelo sku do produto (variação única)
      if (fileStock.has(prod.sku) && prod.variants.length === 1) {
        if (fileStock.get(prod.sku) === v.stock) variantsOk++; else { variantsDivergentes++; divergencias.push(`${v.sku}: arquivo=${fileStock.get(prod.sku)} banco=${v.stock}`); }
      } else variantsSemMatch++;
      continue;
    }
    if (fileStock.get(v.sku) === v.stock) variantsOk++;
    else { variantsDivergentes++; divergencias.push(`${v.sku}: arquivo=${fileStock.get(v.sku)} banco=${v.stock}`); }
  }
}

console.log(`Produtos de óculos (grau+sol): ${products.length}`);
console.log(`  com estoque: ${produtosComEstoque} | sem estoque: ${produtosSemEstoque}`);
console.log(`Variações: iguais ao arquivo=${variantsOk} | divergentes=${variantsDivergentes} | sem match=${variantsSemMatch}`);
console.log(`\nAmostra de divergências (até 12):`);
for (const d of divergencias.slice(0, 12)) console.log("•", d);

// 3) Lista de óculos com estoque hoje (amostra)
console.log(`\nÓculos com estoque no banco (amostra 8):`);
for (const prod of products.filter((x) => x.variants.some((v) => v.active && v.stock > 0)).slice(0, 8)) {
  const s = prod.variants.filter((v) => v.active && v.stock > 0).reduce((a, v) => a + v.stock, 0);
  console.log(`• ${prod.sku} ${prod.name} → ${s} peça(s)`);
}
await p.$disconnect();
