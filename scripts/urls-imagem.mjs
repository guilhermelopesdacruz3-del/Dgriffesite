import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const imgs = await db.productImage.findMany({
  take: 4,
  where: { url: { contains: "awsli" } },
  select: { url: true },
});
console.log(imgs.map((i) => i.url).join("\n"));
await db.$disconnect();
