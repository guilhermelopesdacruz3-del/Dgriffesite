import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const key = "announcement";
const value = "Frete para todo o Brasil com rastreio • Até 6x sem juros • Provador virtual 3D";
const row = await db.setting.findUnique({ where: { key } });
if (row) {
  await db.setting.update({ where: { key }, data: { value } });
  console.log("atualizado:", value);
} else {
  await db.setting.create({ data: { key, value } });
  console.log("criado:", value);
}
const all = await db.setting.findMany({ where: { key } });
console.log("conferência:", all[0]?.value);
await db.$disconnect();
