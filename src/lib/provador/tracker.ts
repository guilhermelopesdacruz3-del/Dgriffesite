/**
 * tracker.ts — Rastreamento facial do provador (Fase 8).
 *
 * Porta fiel de `src/lib/faceTracker.ts` do projeto de referência
 * ("vitrine virtual"): carrega o MediaPipe Face Landmarker (478 pontos) e
 * converte o resultado em pose 3D COMPLETA (posição, yaw/pitch/roll e
 * distância) para o Three.js.
 *
 * A orientação vem de duas fontes:
 *   1. PRINCIPAL — matriz de transformação facial do MediaPipe (rotação real
 *      da cabeça, que faz o óculos girar junto — não um adesivo 2D);
 *   2. RESERVA — base ortonormal construída dos landmarks (verificação
 *      cruzada: se divergir muito, vence a baseada em landmarks).
 *
 * Unidades: milímetros; câmera na origem olhando para -Z.
 */
import * as THREE from "three";

export type Vec2 = { x: number; y: number; z: number };

/** Índices do modelo de 478 pontos do MediaPipe Face Landmarker. */
export const LM = {
  noseBridge: 168,
  noseTip: 1,
  chin: 152,
  forehead: 10,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  irisLeft: 468,
  irisRight: 473,
} as const;

/**
 * Modelo `.task` (float16) de ~3,7 MB — AUTO-HOSPEDADO em public/mediapipe
 * (auditoria A11, LGPD): antes os ChromeCDNs de Google/jsdelivr recebiam o IP
 * do usuário quando a câmera era ativada. Agora os recursos vêm do próprio
 * site: nada de terceiros no provador e funciona até offline (LAN local).
 */
const MODEL_URL = "/mediapipe/face_landmarker.task";

export type TrackerBackend = "landmarker" | null;

/** Resultado de um frame: landmarks + (quando disponível) matriz 4x4. */
export interface TrackResult {
  landmarks: Vec2[];
  matrix: ArrayLike<number> | null;
}

/* ----------------------------------------------------------------------- */
/* Mapeamento tela -> mundo                                                 */
/* ----------------------------------------------------------------------- */

export interface ViewMapping {
  cssW: number; // largura CSS do canvas WebGL
  cssH: number; // altura CSS do canvas WebGL
  srcW: number; // largura natural do vídeo
  srcH: number; // altura natural do vídeo
  mirrored: boolean; // o <video> está com transform: scaleX(-1)
  fit: "cover" | "contain";
  fovDeg: number; // FOV vertical da câmera Three.js
  depth: number; // distância camera -> plano de projeção auxiliar
}

/** Escala usada pelo object-fit para desenhar a mídia dentro do canvas. */
export function fitScale(m: ViewMapping): number {
  return m.fit === "cover"
    ? Math.max(m.cssW / m.srcW, m.cssH / m.srcH)
    : Math.min(m.cssW / m.srcW, m.cssH / m.srcH);
}

/** Landmark normalizado -> posição 3D no plano z = -depth. */
export function landmarkToWorld(
  nx: number,
  ny: number,
  m: ViewMapping,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const s = fitScale(m);
  const dw = m.srcW * s;
  const dh = m.srcH * s;
  const ox = (m.cssW - dw) / 2;
  const oy = (m.cssH - dh) / 2;

  // O vídeo espelhado inverte o eixo X na tela.
  const sx = m.mirrored ? 1 - nx : nx;
  const cx = ox + sx * dw;
  const cy = oy + ny * dh;

  const vh = 2 * Math.tan((m.fovDeg * Math.PI) / 360) * m.depth;
  const vw = vh * (m.cssW / m.cssH);

  return out.set(
    (cx / m.cssW - 0.5) * vw,
    -((cy / m.cssH) * 2 - 1) * (vh / 2),
    -m.depth,
  );
}

/* ----------------------------------------------------------------------- */
/* Pose                                                                     */
/* ----------------------------------------------------------------------- */

export interface SolvedPose {
  /** Centro da linha dos olhos, em mm, no espaço da câmera. */
  position: THREE.Vector3;
  /** Orientação 3D completa da cabeça (yaw + pitch + roll). */
  quaternion: THREE.Quaternion;
  /** Escala do modelo (≈ 1: o mundo já está em milímetros). */
  fitScale: number;
  /** Distância estimada câmera -> rosto, em mm. */
  distanceMm: number;
  /** Qual estimador de rotação foi usado. */
  source: "matrix" | "landmarks";
  /** Quantos mm cada pixel do vídeo vale na profundidade do rosto. */
  mmPerSrcPx: number;
  /** Z (MediaPipe) do centro dos olhos: referência de profundidade. */
  eyeZ: number;
  /** IPD (mm) usado nesta estimativa. */
  ipdMm: number;
  /**
   * Largura do rosto de têmpora a têmpora (mm), landmarks 127/356 — onde ficam
   * as dobradiças. Dimensiona armações de escala desconhecida.
   */
  faceWidthMm: number;
}

/** IPD médio adulto: prior usado até o estimador convergir. */
const DEFAULT_IPD_MM = 63;

/**
 * Diâmetro horizontal da íris humana: ~11,7 mm com variação de ±0,5 mm entre
 * adultos — a "régua" que revela o IPD real:
 *     IPD_mm = (IPD_px / íris_px) × 11,7 mm
 * Prever 63 mm para todos erraria o tamanho da armação em até ±12%. Uma cifra
 * só é ruidosa, então usamos média móvel: rápida no início, estável depois.
 */
const IRIS_DIAMETER_MM = 11.7;

export class IpdEstimator {
  private mm = DEFAULT_IPD_MM;
  private n = 0;

  get value(): number {
    return this.mm;
  }

  /** `ipdPx` e `irisPx` na mesma unidade (pixels do vídeo). */
  update(ipdPx: number, irisPx: number) {
    if (!(irisPx > 3) || !(ipdPx > 3)) return;

    let est = (ipdPx / irisPx) * IRIS_DIAMETER_MM;
    if (est < 45 || est > 85) return; // piscada ou landmark ruim: descarta

    // Estabilizado: cada amostra nova move no máximo ±6 mm.
    if (this.n > 10) est = Math.min(this.mm + 6, Math.max(this.mm - 6, est));

    this.n++;
    // Começa misturando com o prior de 63 mm; depois média móvel ~50 quadros.
    const alpha = Math.max(0.02, 1 / (this.n + 5));
    this.mm += (est - this.mm) * alpha;
    this.mm = Math.min(76, Math.max(52, this.mm));
  }

  reset() {
    this.mm = DEFAULT_IPD_MM;
    this.n = 0;
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _f = new THREE.Vector3();
const _c = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _mtx = new THREE.Matrix4();
const _mirror = new THREE.Matrix4().makeScale(-1, 1, 1);

/**
 * Rotação estimada só com landmarks, usando a profundidade (Z) de cada ponto:
 *   x = linha entre os olhos (direita); y = queixo -> testa (cima); z = x × y.
 * No MediaPipe Z negativo = ponto mais perto da câmera (por isso invertido).
 */
function quaternionFromLandmarks(
  lm: Vec2[],
  eyeA: Vec2,
  eyeB: Vec2,
  m: ViewMapping,
): THREE.Quaternion {
  const sgn = m.mirrored ? -1 : 1;
  const P = (p: Vec2, out: THREE.Vector3) =>
    out.set(sgn * p.x * m.srcW, -p.y * m.srcH, -p.z * m.srcW);

  P(eyeA, _a);
  P(eyeB, _b);
  _x.subVectors(_b, _a);
  if (_x.x < 0) _x.negate(); // +X aponta para a direita da tela
  _x.normalize();

  P(lm[LM.forehead], _f);
  P(lm[LM.chin], _c);
  _y.subVectors(_f, _c);
  _y.addScaledVector(_x, -_y.dot(_x)).normalize(); // Gram-Schmidt

  _z.crossVectors(_x, _y).normalize();

  _mtx.makeBasis(_x, _y, _z);
  return new THREE.Quaternion().setFromRotationMatrix(_mtx);
}

/**
 * Matriz 4x4 do MediaPipe -> quaternion (ajustado ao espelho).
 * O layout (linha/coluna-maior) é detectado: a última linha/coluna da matriz
 * de pose é (0,0,0,1) e a translação ocupa a última coluna.
 */
function quaternionFromMatrix(
  data: ArrayLike<number>,
  mirrored: boolean,
): THREE.Quaternion | null {
  if (!data || data.length < 16) return null;

  const small = (v: number) => Math.abs(v) < 1e-4;
  const colMajor =
    small(data[3]) && small(data[7]) && small(data[11]) && Math.abs(data[15] - 1) < 1e-3;
  const rowMajor =
    small(data[12]) && small(data[13]) && small(data[14]) && Math.abs(data[15] - 1) < 1e-3;
  if (!colMajor && !rowMajor) return null;

  const m4 = new THREE.Matrix4().fromArray(Array.from(data));
  if (!colMajor) m4.transpose();

  // Remove escala: só a rotação importa.
  const c0 = new THREE.Vector3().setFromMatrixColumn(m4, 0).normalize();
  const c1 = new THREE.Vector3().setFromMatrixColumn(m4, 1).normalize();
  const c2 = new THREE.Vector3().setFromMatrixColumn(m4, 2).normalize();
  const R = new THREE.Matrix4().makeBasis(c0, c1, c2);

  // Imagem espelhada na tela = mundo refletido em X: R' = S · R · S
  if (mirrored) R.premultiply(_mirror).multiply(_mirror);

  return new THREE.Quaternion().setFromRotationMatrix(R);
}

/** Resolve posição, orientação, escala e distância a partir de um frame. */
export function solvePose(
  track: TrackResult,
  m: ViewMapping,
  ipd?: IpdEstimator,
): SolvedPose {
  const lm = track.landmarks;
  const g = (i: number) => lm[i];
  const hasIris = lm.length > 473;

  // Centro de cada olho = ponto médio dos DOIS CANTOS (interno e externo).
  // A íris se move com o olhar (a armação deslizaria); os cantos ficam no
  // crânio e não acompanham o olhar — âncora estável.
  const mid = (a: Vec2, b2: Vec2): Vec2 => ({
    x: (a.x + b2.x) / 2,
    y: (a.y + b2.y) / 2,
    z: (a.z + b2.z) / 2,
  });
  const eyeA = mid(g(LM.leftEyeOuter), g(LM.leftEyeInner));
  const eyeB = mid(g(LM.rightEyeOuter), g(LM.rightEyeInner));

  // --- Posição na tela --------------------------------------------------
  landmarkToWorld(eyeA.x, eyeA.y, m, _a);
  landmarkToWorld(eyeB.x, eyeB.y, m, _b);
  const planeMid = new THREE.Vector3().addVectors(_a, _b).multiplyScalar(0.5);

  // --- Distância e escala ------------------------------------------------
  // IPD em 3D (inclui Z): medir só em 2D encolheria a armação ao girar a cabeça.
  const dx = (eyeB.x - eyeA.x) * m.srcW;
  const dy = (eyeB.y - eyeA.y) * m.srcH;
  const dz = (eyeB.z - eyeA.z) * m.srcW;
  const ipdSrcPx = Math.hypot(dx, dy, dz);

  if (ipd && hasIris) {
    const d3 = (i: number, j: number) =>
      Math.hypot(
        (lm[i].x - lm[j].x) * m.srcW,
        (lm[i].y - lm[j].y) * m.srcH,
        (lm[i].z - lm[j].z) * m.srcW,
      );
    const irisA = Math.max(d3(469, 471), d3(470, 472));
    const irisB = Math.max(d3(474, 476), d3(475, 477));
    ipd.update(ipdSrcPx, (irisA + irisB) / 2);
  }
  const ipdMm = ipd ? ipd.value : DEFAULT_IPD_MM;

  const vh = 2 * Math.tan((m.fovDeg * Math.PI) / 360) * m.depth;
  const vw = vh * (m.cssW / m.cssH);
  const wPerSrcPx = fitScale(m) * (vw / m.cssW);
  const ipdAtPlane = ipdSrcPx * wPerSrcPx;

  // Fator que leva o plano auxiliar (distância `depth`) à distância real.
  const f = ipdMm / Math.max(ipdAtPlane, 1e-3);

  // O ponto continua sobre o mesmo raio da câmera: a projeção não muda, mas a
  // perspectiva (hastes fugindo) fica fisicamente correta.
  const position = planeMid.multiplyScalar(f);
  const distanceMm = m.depth * f;
  const mmPerSrcPx = wPerSrcPx * f;
  const eyeZ = (eyeA.z + eyeB.z) / 2;

  // Largura do rosto nas têmporas (3D: não encolhe ao girar).
  let faceWidthMm = 150;
  if (lm.length > 356) {
    const a = lm[127];
    const b = lm[356];
    faceWidthMm =
      Math.hypot(
        (b.x - a.x) * m.srcW,
        (b.y - a.y) * m.srcH,
        (b.z - a.z) * m.srcW,
      ) * mmPerSrcPx;
    faceWidthMm = Math.min(175, Math.max(130, faceWidthMm));
  }

  // --- Orientação ---------------------------------------------------------
  const qLandmarks = quaternionFromLandmarks(lm, eyeA, eyeB, m);
  let quaternion = qLandmarks;
  let source: SolvedPose["source"] = "landmarks";

  if (track.matrix) {
    const qMatrix = quaternionFromMatrix(track.matrix, m.mirrored);
    if (qMatrix) {
      // Verificação cruzada: ângulo entre as duas estimativas.
      const angle = 2 * Math.acos(Math.min(1, Math.abs(qMatrix.dot(qLandmarks))));
      if (angle < 0.9) {
        quaternion = qMatrix;
        source = "matrix";
      }
    }
  }

  return {
    position,
    quaternion,
    fitScale: 1, // o modelo já está em mm, no tamanho físico
    distanceMm,
    source,
    mmPerSrcPx,
    eyeZ,
    ipdMm,
    faceWidthMm,
  };
}

/* ----------------------------------------------------------------------- */
/* Carregamento do MediaPipe                                                */
/* ----------------------------------------------------------------------- */

type FaceLandmarkerLike = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => {
    faceLandmarks?: { x: number; y: number; z: number }[][];
    facialTransformationMatrixes?: { data: ArrayLike<number> }[];
  };
};

export class FaceTracker {
  private backend: TrackerBackend = null;
  private landmarker: FaceLandmarkerLike | null = null;
  private lastVideoTime = -1;
  private lastTrack: TrackResult | null = null;
  public loadError: string | null = null;

  /** Backend carregado (null = ainda não inicializou ou falhou). */
  get backendType(): TrackerBackend {
    return this.backend;
  }

  /**
   * Arestas da tesselação facial do MediaPipe — a malha 3D de oclusão do
   * rosto (`face-mesh.ts`) é derivada delas. null = oclusão cai no elipsoide.
   */
  faceEdges: { start: number; end: number }[] | null = null;

  async init(): Promise<TrackerBackend> {
    if (this.backend) return this.backend;
    try {
      this.landmarker = await this.initLandmarker();
      this.backend = "landmarker";
      return this.backend;
    } catch (err) {
      console.error("[provador] Face Landmarker indisponível:", err);
      this.loadError =
        "Não foi possível carregar o rastreador facial. Verifique sua conexão com a internet.";
      return null;
    }
  }

  private async initLandmarker(): Promise<FaceLandmarkerLike> {
    // O pacote já é dependência do projeto; o WASM e o modelo são servidos
    // LOCAIS de /public/mediapipe (auditoria A11: zero requisição a terceiros).
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
    this.faceEdges = vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION ?? null;

    // GPU é bem mais rápida; em GPUs incompatíveis cai para WASM/CPU.
    for (const delegate of ["GPU", "CPU"] as const) {
      try {
        return (await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          // Matriz 4x4 com a rotação real da cabeça — base do yaw/pitch/roll.
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })) as unknown as FaceLandmarkerLike;
      } catch {
        /* tenta o próximo delegate */
      }
    }
    throw new Error("FaceLandmarker não inicializou");
  }

  /** Executa a detecção em um frame de vídeo. null = nenhum rosto. */
  async detect(video: HTMLVideoElement, timestampMs: number): Promise<TrackResult | null> {
    if (!this.landmarker) return null;

    // Mesmo frame de vídeo? Reaproveita o resultado anterior.
    if (video.currentTime === this.lastVideoTime) return this.lastTrack;
    this.lastVideoTime = video.currentTime;

    try {
      const res = this.landmarker.detectForVideo(video, timestampMs);
      const lm = res?.faceLandmarks?.[0];
      this.lastTrack = lm
        ? { landmarks: lm, matrix: res.facialTransformationMatrixes?.[0]?.data ?? null }
        : null;
      return this.lastTrack;
    } catch {
      return this.lastTrack; // frame perdido: mantém o último resultado
    }
  }
}
