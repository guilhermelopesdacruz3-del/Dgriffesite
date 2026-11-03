/**
 * Gera o ZIP de demonstração para publicar arrastando no Netlify Drop.
 *
 *   node scripts/build-demo-zip.mjs
 *
 * Fluxo:
 *   1. Move (temporariamente) o que exige servidor: rotas /api, middleware,
 *      admin, entrar, criar-conta, minha-conta — e troca page.tsx pelas
 *      variantes estáticas de /produtos e /provador/estudio;
 *   2. roda `next build` com STATIC_EXPORT=1 (gera a pasta `out/` estática);
 *   3. RESTAURA tudo exatamente como estava (finally) — o repositório não
 *      fica modificado.
 *
 * ⚠️ NÃO RODE com o dev server ativo: o build substitui `.next`.
 * Depois do build, empacote com o tar.exe (não use Compress-Archive: ele grava
 * os caminhos com "\" e a Netlify extrai como nomes tortos — CSS/JS quebram):
 *   tar -a -c -f ..\pierre-loja-demo.zip -C out 404 carrinho checkout favoritos `
 *     marcas models produtos provador _next 404.html index.html index.txt
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEMP = path.join(ROOT, ".static-temp");

const DIR = path.join.bind(null, ROOT);
const restoreMoves = [];
/** Pares (caminho, conteúdo-original) das páginas trocadas por variante estática. */
const restorePages = [];

function moveToTemp(relFrom, relTo) {
  const from = DIR(relFrom);
  const to = DIR(relTo);
  if (!existsSync(from)) return;
  mkdirSync(path.dirname(to), { recursive: true });
  renameSync(from, to);
  restoreMoves.push([to, from]); // volta de .static-temp para o original
}

function swapStaticPage(dir) {
  // Troca por CONTEÚDO (sem rename): o original fica em memória e volta no
  // finally. renameSync se perde se algo falhar no meio (lição do build 1).
  const pageFile = DIR(dir, "page.tsx");
  const staticFile = DIR(dir, "page.static.tsx");
  if (!existsSync(pageFile) || !existsSync(staticFile)) {
    throw new Error(`variantes ausentes em ${dir}`);
  }
  const original = readFileSync(pageFile, "utf8");
  const staticContent = readFileSync(staticFile, "utf8");
  writeFileSync(pageFile, staticContent); // page.tsx assume a variante estática
  restorePages.push([pageFile, original]); // original volta intacto no finally
}

/**
 * pequenos patches de fonte: troca "force-dynamic" por "force-static" nos
 * arquivos de flags. `export const dynamic` precisa ser um literal — o Next
 * rejeita expressões condicionais (por isso o patch em vez de ternário).
 */
const PATCH_FILES = [
  "src/app/(store)/layout.tsx",
  "src/app/(store)/marcas/page.tsx",
];
const DYNAMIC_FLAG =
  'export const dynamic = "force-dynamic";';
const patched = []; // [caminho, conteúdo-original]

function patchDynamicFlags() {
  for (const rel of PATCH_FILES) {
    const file = DIR(rel);
    const original = readFileSync(file, "utf8");
    const next = original.split(DYNAMIC_FLAG).join('export const dynamic = "force-static";');
    if (next !== original) {
      writeFileSync(file, next);
      patched.push([file, original]);
    }
  }
}

try {
  mkdirSync(TEMP, { recursive: true });

  // 0) patches de flags dinâmicas
  patchDynamicFlags();

  // 1) rotas que só existem com servidor (404 na demo estática)
  moveToTemp("src/app/api", ".static-temp/api");
  moveToTemp("src/middleware.ts", ".static-temp/middleware.ts");
  moveToTemp("src/app/admin", ".static-temp/admin");
  moveToTemp("src/app/(store)/minha-conta", ".static-temp/minha-conta");
  moveToTemp("src/app/(store)/entrar", ".static-temp/entrar");
  moveToTemp("src/app/(store)/criar-conta", ".static-temp/criar-conta");
  // pedido/paginas: rotas dinâmicas com generateStaticParams vazio — o export
  // estático exige cobertura total de params; esconder resolve (404 na demo)
  moveToTemp("src/app/(store)/pedido", ".static-temp/pedido");
  moveToTemp("src/app/(store)/paginas", ".static-temp/paginas");

  // 2) páginas com variante estática
  swapStaticPage("src/app/(store)/produtos");
  swapStaticPage("src/app/(store)/provador/estudio");

  // 3) build estático
  execSync("npm run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_STATIC: "1" },
  });
  console.log("\n✔ Build estático pronto em out/ — GERE o ZIP (tar.exe, caminhos com /):");
  console.log(
    "  tar -a -c -f C:\\Users\\guilh\\Downloads\\pierre\\pierre-loja-demo.zip -C out 404 carrinho checkout favoritos marcas models produtos provador _next 404.html index.html index.txt",
  );
} catch (err) {
  console.error("\n✖ Falha no build estático:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  // 4) restaura o repositório: patches, páginas trocadas, depois movimentos
  for (const [file, original] of patched.reverse()) {
    try {
      writeFileSync(file, original);
    } catch (err) {
      console.error(`✖ Falha ao restaurar patch ${file}:`, err?.message ?? err);
    }
  }
  for (const [file, original] of restorePages.reverse()) {
    try {
      writeFileSync(file, original);
    } catch (err) {
      console.error(`✖ Falha ao restaurar página ${file}:`, err?.message ?? err);
    }
  }
  for (const [from, to] of restoreMoves.reverse()) {
    try {
      mkdirSync(path.dirname(to), { recursive: true });
      renameSync(from, to);
    } catch (err) {
      console.error(`✖ Falha ao restaurar ${to}:`, err?.message ?? err);
    }
  }
  if (existsSync(TEMP)) {
    try {
      rmdirSync(TEMP);
    } catch {
      /* com conteúdo (não deveria): deixa para inspeção */
    }
  }
  console.log("✔ Repositório restaurado ao estado original.");
}
