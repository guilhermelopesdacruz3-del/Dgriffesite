// Libera venda das joias de prata: estoque 10 nas variações ativas com estoque 0.
// Espelha o comportamento da Loja Integrada (estoque NÃO gerenciado p/ joias).
// Regra: joia que não for ouro puro (mistos "Prata 925/ouro" contam como prata).
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const norm = (v) => (v ?? "").toString().toLowerCase();
const JOIA_RE = /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/;

const products = await p.product.findMany({
  select: { id: true, type: true, name: true, category: { select: { name: true } } },
});

const isJewel = (r) =>
  r.type === "JEWEL" || JOIA_RE.test(norm(r.name)) || JOIA_RE.test(norm(r.category.name));
// Ouro puro: tem "ouro" e não tem "prata" no nome (mistos são base prata 925)
const isPureGold = (r) => /ouro/.test(norm(r.name)) && !/prata/.test(norm(r.name));

const silverLike = products.filter((r) => isJewel(r) && !isPureGold(r));
const ids = silverLike.map((r) => r.id);

console.log(`Joias a liberar (prata + mistas): ${ids.length}`);

const before = await p.productVariant.count({
  where: { productId: { in: ids }, active: true, stock: 0 },
});
console.log(`Variações ativas com estoque 0: ${before}`);

const res = await p.productVariant.updateMany({
  where: { productId: { in: ids }, active: true, stock: 0 },
  data: { stock: 10 },
});
console.log(`Variações atualizadas: ${res.count}`);

await p.$disconnect();
