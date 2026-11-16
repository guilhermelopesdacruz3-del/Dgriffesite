import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const list = await p.product.findMany({
  where: { type: { in: ["FRAMES", "SUNGLASSES"] }, active: true, variants: { every: { stock: 10 } } },
  select: { slug: true, name: true, sku: true },
  take: 3,
});
console.log(JSON.stringify(list, null, 1));
await p.$disconnect();
