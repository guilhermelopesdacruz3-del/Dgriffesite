-- Medidas monoculares (DNP OD/OE) do medidor de DP.
-- Aditiva e anulável: não afeta registros existentes.
ALTER TABLE "CartItem" ADD COLUMN "pupillaryOd" DECIMAL(10,2);
ALTER TABLE "CartItem" ADD COLUMN "pupillaryOe" DECIMAL(10,2);
ALTER TABLE "OrderItem" ADD COLUMN "pupillaryOd" DECIMAL(10,2);
ALTER TABLE "OrderItem" ADD COLUMN "pupillaryOe" DECIMAL(10,2);
