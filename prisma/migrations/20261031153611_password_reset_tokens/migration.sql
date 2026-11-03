-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT,
ALTER COLUMN "marketingOptIn" SET DEFAULT false;
