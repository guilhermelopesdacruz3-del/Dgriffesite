// Estado atual do banco: joias ouro/prata (preço, peso, estoque) + armações.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const products = await p.product.findMany({
  select: { type: true, name: true, category: { select: { name: true } }, active: true, weight: true, price: true, comparePrice: true, sku: true, variants: { select: { stock: true, active: true } } },
});

const norm = (v) => (v ?? "").toString().toLowerCase();
const JOIA_RE = /anel|colar|corrente|brinco|pulseira|pingente|tornozeleira|berloque|separador|dije|broche/;
const isJewel = (r) => r.type === "JEWEL" || JOIA_RE.test(norm(r.name)) || JOIA_RE.test(norm(r.category.name));
const isGold = (r) => /ouro/.test(norm(r.name)) || /ouro/.test(norm(r.category.name));
const comEstoque = (r) => r.variants.some((v) => v.active && v.stock > 0);

const jewels = products.filter(isJewel);
const gold = jewels.filter(isGold);
const silver = jewels.filter((r) => !isGold(r));
const nonJewel = products.filter((r) => !isJewel(r));

const sumVariants = (arr) => arr.reduce((a, r) => a + r.variants.filter((v) => v.active).length, 0);

console.log(`Produtos: ${products.length} | variações ativas: ${sumVariants(products)}`);
console.log(`Joias: ${jewels.length} (ouro ${gold.length} / prata ${silver.length})`);

const stats = (label, arr) => {
  const comPreco = arr.filter((r) => Number(r.price) > 0).length;
  const comPesoReal = arr.filter((r) => r.weight && r.weight >= 1 && r.weight <= 100).length;
  const ativos = arr.filter((r) => r.active).length;
  const vendiveis = arr.filter((r) => r.active && comEstoque(r)).length;
  console.log(`${label}: total=${arr.length} ativos=${ativos} comPreco=${comPreco} pesoReal(1-100g)=${comPesoReal} vendiveis(ativo+estoque)=${vendiveis}`);
};
stats("OURO ", gold);
stats("PRATA", silver);
stats("NAO-JOIA", nonJewel);

// Ouro com peso "real" no banco?
const goldComPeso = gold.filter((r) => r.weight && r.weight >= 1 && r.weight <= 100);
console.log(`\nOuro com peso 1–100g: ${goldComPeso.length}`);
for (const r of goldComPeso.slice(0, 5)) console.log(`• ${r.sku} ${r.name} → ${r.weight}g | R$ ${r.price}`);

// Prata: preços no banco vs arquivo (amostra)
for (const r of silver.filter((r) => Number(r.price) > 0).slice(0, 5)) {
  console.log(`• ${r.sku} ${r.name} → R$ ${r.price} | promocional: ${r.comparePrice ?? "-"}`);
}
await p.$disconnect();
