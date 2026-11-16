// Libera venda dos óculos que na Loja Integrada eram "estoque NÃO gerenciado".
// Mesma regra das joias de prata: ativo=S + gerenciado=N + estoque 0 → estoque 10.
// Os ~145 com controle real de estoque (gerenciado=S) ficam como estão.
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const FILE = "C:/Users/guilh/Downloads/produtos-2026-11-10-09-24-1ac4b5a63cd144c.xlsx";
const p = new PrismaClient();

const norm = (v) => (v ?? "").toString().toLowerCase();
const JOIA_RE = /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/;

// 1) Arquivo: sku → gerenciado (só linhas de óculos)
const wb = read(readFileSync(FILE));
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const gerenciado = new Map();
for (const r of rows) {
  const sku = String(r["sku"]).trim();
  if (!sku) continue;
  gerenciado.set(sku, { ativo: norm(r["ativo"]) === "s", gerenciado: norm(r["estoque-gerenciado"]) === "n" });
}

// 2) Banco: produtos de óculos ativos
const products = await p.product.findMany({
  where: { type: { in: ["FRAMES", "SUNGLASSES", "ACCESSORIES"] }, active: true },
  select: { id: true, sku: true, name: true, variants: { select: { id: true, stock: true, active: true } } },
});

const alvo = products.filter((prod) => {
  const f = gerenciado.get(prod.sku);
  // sem info no arquivo → não mexe; gerenciado real → não mexe
  return f && f.ativo && f.gerenciado;
});
console.log(`Óculos ativos "não gerenciado" na loja antiga: ${alvo.length}`);

const variantIds = alvo.flatMap((prod) => prod.variants.filter((v) => v.active && v.stock === 0).map((v) => v.id));
console.log(`Variações com estoque 0 a liberar: ${variantIds.length}`);

const res = await p.productVariant.updateMany({
  where: { id: { in: variantIds } },
  data: { stock: 10 },
});
console.log(`Variações atualizadas: ${res.count}`);

await p.$disconnect();
