/**
 * Inspecciona a estrutura de um arquivo GLB (glTF binário): validade do
 * container, gerador, malhas/materiais, texturas e caixa envolvente em
 * unidades originais e em mm — para conferir se a escala real será respeitada
 * pela normalização do provador (janela 105–175 mm de largura).
 *
 * Uso: node scripts/inspect-glb.mjs <arquivo.glb>
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("uso: node scripts/inspect-glb.mjs <arquivo.glb>");
  process.exit(1);
}

const buf = readFileSync(file);
console.log("bytes:", buf.length);
console.log("magic:", buf.toString("ascii", 0, 4), "| versão:", buf.readUInt32LE(4));

const chunkLen = buf.readUInt32LE(12);
const chunkType = buf.toString("ascii", 16, 20);
console.log("chunk 0:", chunkType, chunkLen, "bytes");
if (chunkType !== "JSON") {
  console.error("chunk 0 não é JSON: arquivo GLB inválido");
  process.exit(1);
}

const json = JSON.parse(buf.toString("utf8", 20, 20 + chunkLen));
console.log("asset:", JSON.stringify(json.asset ?? {}));
console.log("cena:", (json.scenes ?? []).map((s) => s.name ?? "?").join(", ") || "(sem nome)");
console.log(
  "meshes:",
  (json.meshes ?? []).map((m) => `${m.name ?? "mesh"}(${m.primitives?.length ?? 0} prim)`).slice(0, 12).join(", "),
);
console.log(
  "materiais:",
  (json.materials ?? []).map((m) => m.name ?? "?").slice(0, 12).join(", ") || "(nenhum)",
);
console.log("texturas/imagem:", (json.images ?? []).length);
console.log("extensões usadas:", (json.extensionsUsed ?? []).join(", ") || "(nenhuma)");

// Caixa envolvente global a partir dos acessores POSITION (min/max embutidos).
let min, max;
for (const a of json.accessors ?? []) {
  if (a.type === "VEC3" && a.min && a.max && (a.componentType === 5126 || a.componentType === 5127)) {
    if (!min) {
      min = [...a.min];
      max = [...a.max];
      continue;
    }
    min = min.map((v, i) => Math.min(v, a.min[i]));
    max = max.map((v, i) => Math.max(v, a.max[i]));
  }
}
if (min) {
  const span = max.map((v, i) => v - min[i]);
  const dim = [span[0], span[1], span[2]].map((v) => v.toFixed(3)).join(" × ");
  console.log("bbox (unidades):", dim, "| min:", min.map((v) => v.toFixed(3)), "max:", max.map((v) => v.toFixed(3)));
  const s = span[0]; // largura = X
  for (const [name, k] of [["se metros→mm", 1000], ["se mm (já)", 1]]) {
    const w = s * k;
    const real = w >= 105 && w <= 175;
    console.log(
      `  ${name}: largura ${w.toFixed(1)} mm → ${real ? "ESCALA REAL respeitada" : "normalizada p/ 140 mm"}`,
    );
  }
} else {
  console.log("bbox: não encontrada nos acessores");
}
