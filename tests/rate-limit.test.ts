import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Testes do rate limit em memória (janela deslizante).
 * Relógio fake: controlamos o tempo para provar a reabertura da janela.
 */
describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite até o limite e bloqueia a tentativa seguinte", () => {
    const key = `t:${Math.random()}`; // chave única por execução
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false); // 4ª tentativa bloqueia
  });

  it("chaves diferentes não compartilham o balde", () => {
    const a = `t:a:${Math.random()}`;
    const b = `t:b:${Math.random()}`;
    expect(rateLimit(a, 1, 60_000)).toBe(true);
    expect(rateLimit(a, 1, 60_000)).toBe(false);
    expect(rateLimit(b, 1, 60_000)).toBe(true);
  });

  it("a janela deslizante o demande após o tempo passar", () => {
    const key = `t:window:${Math.random()}`;
    expect(rateLimit(key, 1, 1_000)).toBe(true);
    expect(rateLimit(key, 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_100); // janela virou
    expect(rateLimit(key, 1, 1_000)).toBe(true);
  });
});
