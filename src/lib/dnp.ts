/**
 * Lógica de medição da DNP (Distância Naso-Pupilar) e DP total.
 *
 * Usa os landmarks do MediaPipe Face Landmarker (478 pontos, com íris):
 *  - 468 e 473: centros das íris
 *  - 469-472 e 474-477: contorno das íris (usado para o raio)
 *  - 33, 133, 263, 362: cantos externos e internos dos olhos
 *  - 1: ponta do nariz, 168 e 6: ponte do nariz (linha média)
 *
 * A escala (mm por pixel) é calibrada pelo diâmetro médio da íris (~11,7 mm).
 * Portado do medidor DNP do lojista — mesmo algoritmo.
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Point {
  x: number;
  y: number;
}

export const LM = {
  irisA: 468,
  irisAContour: [469, 470, 471, 472],
  outerA: 33,
  innerA: 133,
  irisB: 473,
  irisBContour: [474, 475, 476, 477],
  outerB: 263,
  innerB: 362,
  noseTip: 1,
  bridgeTop: 168,
  bridgeLow: 6,
} as const;

/** Diâmetro horizontal médio da íris em adultos (mm). */
export const DEFAULT_IRIS_MM = 11.7;

export interface Metrics {
  /** DNP do olho direito do paciente (mm) */
  od: number;
  /** DNP do olho esquerdo do paciente (mm) */
  oe: number;
  /** DP total = OD + OE (mm) */
  dp: number;
  mmPerPx: number;
  /** Inclinação da cabeça em graus */
  roll: number;
  /** 0 = rosto totalmente de frente */
  asymmetry: number;
  /** Desvio do olhar em relação ao centro (0 = olhando reto) */
  gazeDev: number;
  /** Largura entre os olhos em relação à largura do quadro */
  faceRatio: number;
}

export interface FaceGeometry {
  odIris: Point;
  oeIris: Point;
  odRadius: number;
  oeRadius: number;
  midX: number;
}

export interface FrameReading {
  metrics: Metrics;
  issues: string[];
  geo: FaceGeometry;
}

export interface DnpResult {
  id: string;
  createdAt: number;
  od: number;
  oe: number;
  dp: number;
  samples: number;
}

const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function stdDev(values: number[]): number {
  const m = avg(values);
  return Math.sqrt(avg(values.map((v) => (v - m) ** 2)));
}

/** Arredonda para a menor fração usual de receita óptica (0,5 mm). */
export const roundHalf = (v: number) => Math.round(v * 2) / 2;

export const fmtNumber = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtMM = (v: number) => `${fmtNumber(roundHalf(v))} mm`;

/**
 * Analisa os landmarks de um frame e devolve as medidas em mm
 * junto com a lista de problemas de posicionamento (vazia = pronto para medir).
 */
export function analyzeFace(
  lm: Landmark[],
  W: number,
  H: number,
  irisMM: number,
  blinking: boolean,
): FrameReading {
  const P = (i: number): Point => ({ x: lm[i].x * W, y: lm[i].y * H });
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  const makeEye = (ci: number, contour: readonly number[], outer: number, inner: number) => {
    const iris = P(ci);
    const radius = avg(contour.map((i) => dist(iris, P(i))));
    return { iris, radius, outer: P(outer), inner: P(inner) };
  };

  // Ordena pelos centros das íris: o olho com menor X é o olho direito do paciente (OD)
  const [od, oe] = [
    makeEye(LM.irisA, LM.irisAContour, LM.outerA, LM.innerA),
    makeEye(LM.irisB, LM.irisBContour, LM.outerB, LM.innerB),
  ].sort((p, q) => p.iris.x - q.iris.x);

  // Escala: diâmetro médio da íris = 2 * raio médio → mm/px
  const mmPerPx = irisMM / (od.radius + oe.radius);

  // Linha média (ponte do nariz)
  const midX = (P(LM.bridgeTop).x + P(LM.bridgeLow).x) / 2;

  const odMM = Math.abs(od.iris.x - midX) * mmPerPx;
  const oeMM = Math.abs(oe.iris.x - midX) * mmPerPx;
  const dp = odMM + oeMM;

  // Postura: simetria da ponta do nariz em relação aos cantos externos
  const nose = P(LM.noseTip);
  const d1 = dist(nose, od.outer);
  const d2 = dist(nose, oe.outer);
  const asymmetry = Math.abs(d1 - d2) / (d1 + d2);

  // Inclinação (roll) pela linha entre as íris
  const roll = (Math.atan2(oe.iris.y - od.iris.y, oe.iris.x - od.iris.x) * 180) / Math.PI;

  // Largura entre os olhos relativa ao quadro (distância da câmera)
  const faceRatio = dist(od.outer, oe.outer) / W;

  // Olhar: posição da íris entre os cantos (0,5 = olhando reto)
  const gazeOD = (od.iris.x - od.outer.x) / (od.inner.x - od.outer.x);
  const gazeOE = (oe.iris.x - oe.outer.x) / (oe.inner.x - oe.outer.x);
  const gazeDev = Math.max(Math.abs(gazeOD - 0.5), Math.abs(gazeOE - 0.5));

  const issues: string[] = [];
  const noseNX = lm[LM.noseTip].x;
  const noseNY = lm[LM.noseTip].y;
  if (noseNX < 0.3 || noseNX > 0.7 || noseNY < 0.2 || noseNY > 0.8) {
    issues.push("Centralize o rosto na tela");
  }
  if (faceRatio < 0.12) issues.push("Aproxime-se da câmera");
  else if (faceRatio > 0.32) issues.push("Afaste-se um pouco da câmera");
  if (asymmetry > 0.05) issues.push("Olhe de frente, sem girar a cabeça");
  if (Math.abs(roll) > 4) issues.push("Endireite a cabeça");
  if (gazeDev > 0.15) issues.push("Olhe diretamente para a câmera");
  if (blinking) issues.push("Mantenha os olhos abertos");

  return {
    metrics: { od: odMM, oe: oeMM, dp, mmPerPx, roll, asymmetry, gazeDev, faceRatio },
    issues,
    geo: {
      odIris: od.iris,
      oeIris: oe.iris,
      odRadius: od.radius,
      oeRadius: oe.radius,
      midX,
    },
  };
}
