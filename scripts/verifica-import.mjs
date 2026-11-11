import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const byType = await db.product.groupBy({ by: ["type", "active"], _count: true, where: { active: true } });
const g = await db.product.groupBy({ by: ["type"], _count: true });
const total = await db.product.count();
console.log("TOTAL produtos:", total);
console.log("\nPor tipo (todos):");
for (const r of g) console.log(`  ${r.type}: ${r._count}`);

console.log("\nAtivos por tipo:");
for (const r of byType.filter((x) => x.active)) console.log(`  ${r.type}: ${r._count}`);

const cats = await db.category.findMany({ select: { name: true, slug: true, _count: { select: { products: true } } } });
console.log("\nCategorias:");
for (const c of cats) console.log(`  ${c.name} (${c.slug}): ${c._count.products} produtos`);

// joias ouro ocultas vs prata visível
const joiasCat = await db.category.findUnique({ where: { slug: "joias" }, select: { id: true } });
const prataCat = await db.category.findUnique({ where: { slug: "prata" }, select: { id: true } });
const joiasOcultas = await db.product.count({ where: { type: "JEWEL", active: false } });
const joiasVisiveis = await db.product.count({ where: { type: "JEWEL", active: true } });
console.log(`\nJoias (JEWEL): ocultas ${joiasOcultas} | visíveis ${joiasVisiveis}`);

// variações com estoque real
const comEstoque = await db.productVariant.count({ where: { stock: { gt: 0 } } });
console.log("variações com estoque > 0:", comEstoque);

// amostras: Ray-Ban Aviator, uma lente de contato, uma prata, sem preço não-joia
const amostras = await db.product.findMany({
  where: { sku: { in: ["0RB3025", "S001"] } },
  select: { sku: true, name: true, slug: true, price: true, active: true, type: true, _count: { select: { variants: true, images: true } } },
});
console.log("\nAmostras:");
for (const p of amostras) console.log(`  ${p.sku} | ${p.name.slice(0, 50)} | ${p.type} | R$ ${p.price} | ${p.active ? "visível" : "oculto"} | ${p._count.variants} var | ${p._count.images} img`);

const semPreco = await db.product.findMany({
  where: { price: 0, type: { not: "JEWEL" } },
  select: { sku: true, name: true, type: true, active: true },
  take: 12,
});
console.log("\nSem preço (não-joia):", semPreco.length);
for (const p of semPreco) console.log(`  ${p.sku} | ${p.name.slice(0, 55)} | ${p.type} | ${p.active ? "visível" : "oculto"}`);

// marcas criadas
const marcas = await db.brand.count({ where: { active: true } });
console.log("\nmarcas ativas:", marcas);

await db.$disconnect();
