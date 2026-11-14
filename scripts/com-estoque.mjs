import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const prods = await db.product.findMany({
  where: { type: "FRAMES", active: true, variants: { some: { stock: { gt: 0 } } } },
  select: { slug: true, name: true, variants: { where: { stock: { gt: 0 } }, select: { stock: true } } },
  take: 5,
});
for (const p of prods) console.log(`${p.slug} | ${p.name} | estoque ${p.variants.reduce((s, v) => s + v.stock, 0)}`);
await db.$disconnect();
