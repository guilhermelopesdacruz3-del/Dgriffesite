import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.product.findFirst({ where: { sku: "A005" }, select: { slug: true, name: true, active: true, variants: { select: { stock: true } } } });
console.log(JSON.stringify(r));
await p.$disconnect();
