/**
 * Rate limit simples em memória (janela deslizante).
 * Suficiente para dev/monolito; para produção multi-instância troque por
 * Redis/Upstash com a mesma função de interface.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000; // evita estourar memória sob ataque

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
