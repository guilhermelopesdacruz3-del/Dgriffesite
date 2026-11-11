import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const total = await db.product.count();
const joias = await db.product.count({ where: { type: "JEWEL" } });
const ativos = await db.product.count({ where: { active: true } });
console.log(`produtos no banco: ${total} (ativos: ${ativos}, joias: ${joias})`);
await db.$disconnect();
