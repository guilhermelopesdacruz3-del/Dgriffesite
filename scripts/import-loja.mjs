/**
 * Fase 15 — importa o catálogo real (export "Product Report" da Loja Integrada).
 *
 * Regras combinadas com a D'Griffe:
 *  - apenas produtos ativos (ativo=S) e variações ativas;
 *  - óculos, lentes de contato e prata entram VISÍVEIS;
 *  - joias em ouro entram OCULTAS (active=false) até o peso (g) ser cadastrado
 *    no painel — aí a calculadora por grama precifica e podem ser ativadas;
 *  - sem estoque (sob encomenda) entra com stock=0 → "esgotado"; só vende
 *    com estoque no sistema;
 *  - imagens ficam no CDN da Loja Integrada (remotePatterns no next.config);
 *  - idempotente: upsert por SKU — pode rodar de novo sem duplicar.
 *
 * Uso: node scripts/import-loja.mjs <arquivo.xlsx>
 */
import { PrismaClient } from "@prisma/client";
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const db = new PrismaClient();
const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/import-loja.mjs <arquivo.xlsx>");
  process.exit(1);
}

// ----------------------------- helpers -----------------------------

const norm = (s) => String(s ?? "").toLowerCase();
const slugify = (v) =>
  norm(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// minúsculas + sem acento (para casar "Aliança"→"alianca", "Óculos"→"oculos")
const flat = (s) => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const JOIA_RE = /alianca|anel|colar|corrente|pingente|brinco|gargantilha|conjunto|bracelete|pulseira|aparelho/;

/** Tipo + gênero + categoria do site a partir da linha da planilha. */
function classify(row) {
  const n = flat(row.nome);
  const c1 = flat(row["categoria-nome-nivel-1"]);
  const c3 = flat(row["categoria-nome-nivel-3"]);
  const infantil = /infantil|infanto|kids/.test(n + c3);

  if (c1 === "prata") return { type: "JEWEL", gold: false, cat: "prata" };
  if (c1 === "jóias") return { type: "JEWEL", gold: true, cat: "joias" };
  if (c1 === "lentes de contato" || (/lente/.test(n) && /contato/.test(n))) {
    return { type: "CONTACT_LENSES", cat: "lentes-de-contato" };
  }
  if (c1 === "óculos" || /oculos/.test(n)) {
    const sol = /de sol|solar|sunglass/.test(n) || /sol/.test(c3);
    return {
      type: sol ? "SUNGLASSES" : "FRAMES",
      cat: infantil ? "oculos-infantis" : sol ? "oculos-de-sol" : "oculos-de-grau",
      ...(infantil ? { gender: "KIDS" } : {}),
    };
  }
  if (JOIA_RE.test(n)) {
    const prataNome = /prata/.test(n);
    return { type: "JEWEL", gold: !prataNome, cat: prataNome ? "prata" : "joias" };
  }
  // resto: clipon / genéricos de ótica → armação de grau
  return { type: "FRAMES", cat: "oculos-de-grau" };
}

function genderOf(row) {
  const n = flat(row.nome) + flat(row["categoria-nome-nivel-3"]);
  if (/infantil|infanto|kids/.test(n)) return "KIDS";
  if (/feminino|feminina/.test(n)) return "FEMININE";
  if (/masculino|masculina/.test(n)) return "MASCULINE";
  return "UNISEX";
}

/** Preço de venda de uma linha: promocional > cheio > null. */
function sellingPrice(r) {
  const cheio = num(r["preco-cheio"]);
  const promo = num(r["preco-promocional"]);
  if (promo > 0) return promo;
  if (cheio > 0) return cheio;
  return null;
}

/** Variação do Prisma a partir da linha da planilha. */
function toVariant(v, type) {
  let colorName = String(v["grade-cores-disponiveis"] || "").trim();
  let size = String(v["grade-tamanho"] || "").trim();

  if (type === "CONTACT_LENSES") {
    const esf = String(v["grade-grau-esferico"] || "").trim();
    const cil = String(v["grade-grau-cilindrico"] || "").trim();
    colorName = ["Grau " + esf, cil ? "Cil " + cil : ""].filter(Boolean).join(" · ");
    const curva = String(v["grade-curva-base"] || "").trim();
    size = curva ? "Curva " + curva : "";
  } else if (type === "JEWEL") {
    const k = String(v["grade-quilates-k"] || "").trim();
    if (k) colorName = "Ouro " + k;
    if (size) size = "Tam " + size;
  } else {
    const lente = String(v["grade-tipo-de-lente"] || "").trim();
    size = [size, lente].filter(Boolean).join(" · ");
  }

  const varPrice = sellingPrice(v);
  return {
    sku: String(v.sku || "").trim(),
    colorName: colorName || "Único",
    colorHex: null,
    size: size || "",
    stock: Math.max(0, Math.trunc(num(v["estoque-quantidade"]))),
    priceOverride: null, // preenchido depois, relativo ao preço do produto
    active: true,
    _price: varPrice,
  };
}

// ----------------------------- carga -----------------------------

const wb = read(readFileSync(file), { cellDates: true, type: "buffer" });
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const H = rows[0];
const D = rows.slice(1).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i] ?? ""])));

const parents = D.filter((r) => r.tipo !== "variacao" && r.ativo === "S");
const variantsByParent = new Map();
let totalVars = 0;
for (const r of D.filter((x) => x.tipo === "variacao" && x.ativo === "S")) {
  const list = variantsByParent.get(r["sku-pai"]) ?? [];
  list.push(r);
  variantsByParent.set(r["sku-pai"], list);
  totalVars++;
}
console.log(`Planilha: ${parents.length} pais ativos, ${totalVars} variações ativas`);

// categorias do site (cria a de prata; valida as demais)
await db.category.upsert({
  where: { slug: "prata" },
  update: {},
  create: { name: "Prata", slug: "prata", description: "Joias em prata 925.", sortOrder: 6 },
});
for (const slug of ["oculos-de-grau", "oculos-de-sol", "oculos-infantis", "lentes-de-contato", "joias"]) {
  if (!(await db.category.findUnique({ where: { slug } }))) {
    throw new Error(`Categoria esperada não encontrada: ${slug}`);
  }
}
const categoryBySlug = new Map(
  (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
);
const categoryIdBySlug = (slug) => {
  const id = categoryBySlug.get(slug);
  if (!id) throw new Error(`categoria não encontrada: ${slug}`);
  return id;
};

// desliga os produtos de demonstração do seed (a loja real assume a vitrine)
const DEMO_BRANDS = ["Atelier Óptico", "Verano", "Lumen", "Órbita", "Nordica", "Cristalina", "Maré", "Andino", "D'Griffe Joias"];
const off = await db.product.updateMany({ where: { brand: { name: { in: DEMO_BRANDS } } }, data: { active: false } });
console.log(`Produtos de demonstração desativados: ${off.count}`);
await db.brand.updateMany({ where: { name: { in: DEMO_BRANDS } }, data: { active: false } });

const brandIds = new Map();
async function brandIdFor(name) {
  if (brandIds.has(name)) return brandIds.get(name);
  const b = await db.brand.upsert({
    where: { name },
    update: { active: true },
    create: { name, slug: slugify(name) || `marca-${brandIds.size}`, active: true },
  });
  brandIds.set(name, b.id);
  return b.id;
}

const stats = { ok: 0, ocultosOuro: 0, variantes: 0, imagens: 0, semPreco: 0, erro: 0 };
const erros = [];

let done = 0;
for (const row of parents) {
  try {
    const cls = classify(row);
    const gender = cls.gender ?? genderOf(row);
    const name = String(row.nome || "").trim() || String(row.sku).trim();
    const sku = String(row.sku).trim();
    const slug = `${slugify(name) || "produto"}-${slugify(sku)}`;
    const brandId = await brandIdFor(String(row.marca || "").trim() || "Outros");

    // variações ativas (garante ao menos 1 para o checkout funcionar)
    const rawVars = variantsByParent.get(row.sku) ?? [];
    let variants = rawVars.map((v) => toVariant(v, cls.type));
    if (variants.length === 0) {
      variants = [{
        sku,
        colorName: "Único",
        colorHex: null,
        size: "",
        stock: Math.max(0, Math.trunc(num(row["estoque-quantidade"]))),
        priceOverride: null,
        active: true,
        _price: null,
      }];
    }

    // preço do produto: pai → primeira variação com preço
    let price = sellingPrice(row);
    if (price === null) {
      for (const v of rawVars) { const p = sellingPrice(v); if (p !== null) { price = p; break; } }
    }
    if (price === null) price = 0; // joias em ouro: a calculadora precifica
    const cheio = num(row["preco-cheio"]);
    const comparePrice = cheio > price ? cheio : null;

    // priceOverride relativo ao preço do produto
    variants = variants.map(({ _price, ...v }) => ({
      ...v,
      priceOverride: _price !== null && Math.abs(_price - price) > 0.005 ? _price.toFixed(2) : null,
    }));

    // custo interno (não exibe)
    let cost = num(row["preco-custo"]);
    if (cost <= 0) {
      for (const v of rawVars) { const c = num(v["preco-custo"]); if (c > 0) { cost = c; break; } }
    }

    const images = [1, 2, 3, 4, 5].map((i) => String(row[`imagem-${i}`] || "").trim()).filter(Boolean);
    const description = stripHtml(row["descricao-completa"]) || `${name} — ${row.marca || "D'Griffe"}.`;
    const gold = cls.type === "JEWEL" && cls.gold; // ouro: oculto até ter peso
    // sem preço e sem calculadora (não é joia) → não pode aparecer com R$ 0,00
    const semPreco = price === 0 && cls.type !== "JEWEL";

    const data = {
      name,
      slug,
      sku,
      type: cls.type,
      gender,
      description,
      shortDescription: description.slice(0, 160) || null,
      price: price.toFixed(2),
      comparePrice: comparePrice !== null ? comparePrice.toFixed(2) : null,
      cost: cost > 0 ? cost.toFixed(2) : null,
      isFeatured: row.destaque === "S",
      active: !gold && !semPreco,
      seoTitle: String(row["seo-tag-title"] || "").trim() || null,
      seoDescription: String(row["seo-tag-description"] || "").trim() || null,
      brandId,
      categoryId: categoryIdBySlug(cls.cat),
    };

    const existing = await db.product.findUnique({
      where: { sku },
      select: { id: true, variants: { select: { id: true, sku: true } }, images: { select: { id: true, url: true, isMain: true } } },
    });
    let productId;
    if (existing) {
      await db.product.update({ where: { sku }, data });
      productId = existing.id;
      for (const v of variants) {
        const found = existing.variants.find((x) => x.sku === v.sku);
        if (found) await db.productVariant.update({ where: { id: found.id }, data: v });
        else await db.productVariant.create({ data: { ...v, productId } });
      }
      const existingUrls = new Set(existing.images.map((im) => im.url));
      let pos = existing.images.length;
      for (const url of images) {
        if (existingUrls.has(url)) continue;
        await db.productImage.create({
          data: { url, alt: `${name} — foto ${pos + 1}`, position: pos, isMain: existing.images.every((im) => !im.isMain) && pos === 0, productId },
        });
        pos++;
      }
    } else {
      const created = await db.product.create({
        data: {
          ...data,
          variants: { create: variants },
          images: { create: images.map((url, i) => ({ url, alt: `${name} — foto ${i + 1}`, position: i, isMain: i === 0 })) },
        },
        select: { id: true },
      });
      productId = created.id;
    }

    stats.ok++;
    if (gold) stats.ocultosOuro++;
    if (semPreco) stats.semPreco++;
    stats.variantes += variants.length;
    stats.imagens += images.length;
  } catch (err) {
    stats.erro++;
    if (erros.length < 5) erros.push(`${row.sku}: ${err.message}`);
  }
  if (++done % 200 === 0) console.log(`  … ${done}/${parents.length}`);
}

console.log("\n===== RESUMO =====");
console.log(JSON.stringify(stats, null, 2));
if (erros.length) console.log("primeiros erros:", erros.join(" | "));
await db.$disconnect();
