/**
 * Fase 14 — ativa Joias no banco de produção de forma SEGURA (apenas upsert).
 * Nada é apagado: marca, categoria, cotação do ouro e 3 joias de exemplo.
 * Uso: node scripts/add-joias.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Mesma fórmula de src/lib/jewelry.ts (mantida aqui para rodar fora do Next)
const GOLD_MULTIPLIER = 2.7;
const gold = 420.0; // coincide com o default semeado — ajuste depois no painel
const price = (grams) => (grams * gold * GOLD_MULTIPLIER).toFixed(2);

const brand = await db.brand.upsert({
  where: { name: "D'Griffe Joias" },
  update: {},
  create: { name: "D'Griffe Joias", slug: "dgriffe-joias", description: "Joias em ouro feitas com artesanato próprio." },
});
console.log("marca:", brand.name);

const category = await db.category.upsert({
  where: { slug: "joias" },
  update: {},
  create: { name: "Joias", slug: "joias", description: "Joias em ouro vendidas por grama.", sortOrder: 5 },
});
console.log("categoria:", category.name);

const setting = await db.setting.upsert({
  where: { key: "goldPricePerGram" },
  update: {},
  create: { key: "goldPricePerGram", value: gold.toFixed(2) },
});
console.log("cotação do ouro (R$/g):", setting.value);

const jewels = [
  { name: "Aliança D'Griffe", slug: "alianca-dgriffe", gender: "UNISEX", weight: 10, description: "Aliança em ouro 18k de 10 g. Preço calculado por peso: gramas × cotação do dia × 2,7." },
  { name: "Anel Aparador D'Griffe", slug: "anel-aparador-dgriffe", gender: "FEMININE", weight: 6, description: "Aparador em ouro 18k de 6 g, polimento brilhante. Preço por peso: gramas × cotação do dia × 2,7." },
  { name: "Colar Corrente D'Griffe", slug: "colar-corrente-dgriffe", gender: "UNISEX", weight: 18, description: "Corrente em ouro 18k de 18 g, fecho mosquetão. Preço por peso: gramas × cotação do dia × 2,7." },
];

for (const j of jewels) {
  const product = await db.product.upsert({
    where: { slug: j.slug },
    update: {},
    create: {
      name: j.name,
      slug: j.slug,
      sku: `JWL-${j.slug.toUpperCase().slice(0, 12)}`,
      type: "JEWEL",
      gender: j.gender,
      material: "Ouro 18k",
      weight: j.weight,
      price: price(j.weight),
      description: j.description,
      shortDescription: "Joia em ouro 18k — preço por grama.",
      brandId: brand.id,
      categoryId: category.id,
      isNew: false,
      active: true,
      variants: { create: { sku: `${j.slug.toUpperCase().slice(0, 10)}-AU`, colorName: "Ouro 18k", colorHex: "#b8860b", size: null, stock: 5 } },
    },
    select: { id: true, name: true, weight: true, price: true },
  });
  console.log("joia:", product.name, `${product.weight}g`, `R$ ${Number(product.price).toFixed(2)}`);
}

await db.$disconnect();
console.log("\n✓ Joias habilitadas — nada existente foi alterado.");
