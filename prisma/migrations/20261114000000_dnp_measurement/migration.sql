-- Medição de DP (distância pupilar) para venda de lentes de grau.
-- Aditiva e anulável: não afeta registros existentes.
ALTER TABLE "CartItem" ADD COLUMN "pupillaryDistance" DECIMAL(10,2);
ALTER TABLE "OrderItem" ADD COLUMN "pupillaryDistance" DECIMAL(10,2);
