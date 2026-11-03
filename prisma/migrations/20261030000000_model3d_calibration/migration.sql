-- Fase 7: calibração completa por modelo 3D (estúdio sava turn/stretch/tilt).
-- AlterTable
ALTER TABLE "Model3D" ADD COLUMN     "stretchX" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "stretchY" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "tilt" DOUBLE PRECISION NOT NULL DEFAULT 6,
ADD COLUMN     "turn" BOOLEAN NOT NULL DEFAULT false;
