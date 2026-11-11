import { describe, expect, it } from "vitest";
import {
  GOLD_MULTIPLIER,
  computeGoldPrice,
  DEFAULT_GOLD_PRICE_PER_GRAM,
  parseXauBrlPerGram,
} from "@/lib/jewelry";

/** Fase 14 — fórmula das joias: precoFinal = gramas × cotação × 2,7. */
describe("joias — preço por grama", () => {
  it("aplica a fórmula exata (10g × 420 × 2,7 = 11340)", () => {
    expect(computeGoldPrice(10, 420)).toBe(11340);
  });

  it("arredonda para centavos", () => {
    expect(computeGoldPrice(2, 100.05)).toBe(540.27);
  });

  it("zona morta: peso zero vale zero", () => {
    expect(computeGoldPrice(0, 420)).toBe(0);
  });

  it("multiplicador e cotação padrão do sistema", () => {
    expect(GOLD_MULTIPLIER).toBe(2.7);
    expect(DEFAULT_GOLD_PRICE_PER_GRAM).toBeGreaterThan(0);
  });
});

/** Fase 14b — cotação automática XAU-BRL (R$ por troy ounce → R$ por grama). */
describe("joias — cotação externa (XAU-BRL)", () => {
  it("converte troy ounce → grama (22538.10 ÷ 31,1035)", () => {
    expect(parseXauBrlPerGram("22538.1")).toBe(Math.round((22538.1 / 31.1034768) * 100) / 100);
  });

  it("valores inválidos viram NaN (fonte não altera preços)", () => {
    expect(Number.isNaN(parseXauBrlPerGram(""))).toBe(true);
    expect(Number.isNaN(parseXauBrlPerGram("0"))).toBe(true);
    expect(Number.isNaN(parseXauBrlPerGram("-5"))).toBe(true);
    expect(Number.isNaN(parseXauBrlPerGram("abc"))).toBe(true);
  });
});
