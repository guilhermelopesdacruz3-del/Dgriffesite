import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest — testes unitários do backend puro (sem banco, sem rede).
 * Rodar: `npm test` (uma vez) ou `npm run test:watch`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // carrega o .env da loja (mesma base de valores do dev/build)
    setupFiles: ["dotenv/config"],
  },
});
