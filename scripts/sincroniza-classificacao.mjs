/**
 * Sincronização dirigida pós-import: recalcula a classificação (tipo, gênero,
 * categoria, visibilidade, preço) de cada produto ATIVO da planilha e atualiza
 * no banco apenas os que divergem — rápido o suficiente para rodar sempre.
 *
 * Uso: node scripts/sincroniza-classificacao.mjs <arquivo.xlsx>
 */
import { PrismaClient } from "@prisma/client";
import { read, utils } from "xlsx";
import { readFileSync } from "node:fs";

const db = new PrismaClient();
const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/sincroniza-classificacao.mjs <arquivo.xlsx>");
  process.exit(1);
}

const norm = (s) => String(s ?? "").toLowerCase();
const flat = (s) => norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const JOIA_RE =
  /alianca|anel|colar|corrente|pingente|brinco|gargantilha|conjunto|bracelete|pulseira|aparelho|tornozeleira|berloque|separador|dije/;

function classify(row) {
  const n = flat(row.nome);
  const c1 = flat(row["categoria-nome-nivel-1"]);
  const c3 = flat(row["categoria-nome-nivel-3"]);
  const infantil = /infantil|infanto|kids/.test(n + c3);

  if (c1 === "prata") return { type: "JEWEL", gold: false, cat: "prata" };
  if (c1 === "joias") return { type: "JEWEL", gold: true, cat: "joias" };
  if (c1 === "lentes de contato" || (/lente/.test(n) && /contato/.test(n))) {
    return { type: "CONTACT_LENSES", cat: "lentes-de-contato" };
  }
  if (!c1 && JOIA_RE.test(n)) {
    const prataNome = /prata/.test(n);
    return { type: "JEWEL", gold: !prataNome, cat: prataNome ? "prata" : "joias" };
  }
  if (c1 === "oculos" || /oculos/.test(n)) {
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
  return { type: "FRAMES", cat: "oculos-de-grau" };
}

function genderOf(row) {
  const n = flat(row.nome) + flat(row["categoria-nome-nivel-3"]);
  if (/infantil|infanto|kids/.test(n)) return "KIDS";
  if (/feminino|feminina/.test(n)) return "FEMININE";
  if (/masculino|masculina/.test(n)) return "MASCULINE";
  return "UNISEX";
}

function sellingPrice(r) {
  const cheio = num(r["preco-cheio"]);
  const promo = num(r["preco-promocional"]);
  if (promo > 0) return promo;
  if (cheio > 0) return cheio;
  return null;
}

// ---------------- carga da planilha ----------------
const wb = read(readFileSync(file), { cellDates: true, type: "buffer" });
const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const H = rows[0];
const D = rows.slice(1).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i] ?? ""])));
const parents = D.filter((r) => r.tipo !== "variacao" && r.ativo === "S");
const varsByParent = new Map();
for (const r of D.filter((x) => x.tipo === "variacao" && x.ativo === "S")) {
  const list = varsByParent.get(r["sku-pai"]) ?? [];
  list.push(r);
  varsByParent.set(r["sku-pai"], list);
}

// ---------------- estado do banco ----------------
const catBySlug = new Map(
  (await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]),
);
const dbProducts = await db.product.findMany({
  select: { sku: true, id: true, type: true, gender: true, categoryId: true, active: true, price: true },
});
const bySku = new Map(dbProducts.map((p) => [p.sku, p]));

// ---------------- compara e corrige ----------------
let iguais = 0;
let corrigidos = 0;
let ausentes = 0;
const detalhes = [];

for (const row of parents) {
  const sku = String(row.sku).trim();
  const p = bySku.get(sku);
  if (!p) { ausentes++; continue; }

  const cls = classify(row);
  const price0 = sellingPrice(row) ?? (varsByParent.get(sku) ?? []).map(sellingPrice).find((v) => v !== null) ?? 0;
  const gold = cls.type === "JEWEL" && cls.gold;
  const semPreco = price0 === 0 && cls.type !== "JEWEL";
  const want = {
    type: cls.type,
    gender: cls.gender ?? genderOf(row),
    categoryId: catBySlug.get(cls.cat),
    active: !gold && !semPreco,
  };

  const diff = {};
  if (p.type !== want.type) diff.type = want.type;
  if (p.gender !== want.gender) diff.gender = want.gender;
  if (p.categoryId !== want.categoryId) diff.categoryId = want.categoryId;
  if (p.active !== want.active) diff.active = want.active;

  if (Object.keys(diff).length === 0) { iguais++; continue; }
  await db.product.update({ where: { id: p.id }, data: diff });
  corrigidos++;
  detalhes.push(`${sku}: ${diff.type ?? ""}${diff.categoryId ? " cat" : ""}${diff.active !== undefined ? ` ativo=${want.active}` : ""}`.trim());
}

console.log(`planilha: ${parents.length} pais ativos | banco: iguais=${iguais} corrigidos=${corrigidos} ausentes=${ausentes}`);
for (const d of detalhes.slice(0, 30)) console.log("  •", d);

await db.$disconnect();
