import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const pkgs = await db.lensPackage.findMany({ orderBy: { sortOrder: "asc" } });
console.log(`LensPackage total: ${pkgs.length} (ativos: ${pkgs.filter(p => p.active).length})`);
for (const p of pkgs) console.log(`  • ${p.name} | R$ ${p.price} | ${p.active ? "ativo" : "inativo"}`);
const presc = await db.prescription.count();
console.log(`Receitas enviadas: ${presc}`);
await db.$disconnect();
