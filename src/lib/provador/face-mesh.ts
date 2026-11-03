/**
 * face-mesh.ts — malha 3D do rosto REAL da pessoa (Fase 8).
 *
 * Porta fiel de `src/lib/faceMesh.ts` da referência. Reconstruída a cada
 * quadro a partir dos 468 landmarks do MediaPipe; cumpre dois papéis:
 *
 *   1. OCLUSÃO — grava só a profundidade (não pinta cor). Tudo da armação que
 *      estiver atrás da pele fica escondido: a haste some atrás da bochecha e
 *      da têmpora ao virar a cabeça, e a ponte se encaixa no nariz. É a
 *      diferença entre "adesivo por cima do rosto" e "óculos apoiados".
 *
 *   2. SOMBRA — recebe a sombra projetada pela armação (aros e hastes sombreados
 *      na pele, nas pálpebras e na lateral do nariz), com formato que acompanha
 *      o relevo do rosto em vez de um plano reto.
 *
 * Substitui o elipsoide genérico, que ignora nariz, sobrancelha e maçãs do
 * rosto. Unidades: milímetros; câmera na origem olhando para -Z.
 */
import * as THREE from "three";
import { landmarkToWorld, type SolvedPose, type Vec2, type ViewMapping } from "./tracker";

/** Número de pontos da malha facial (a íris, 468–477, não faz parte dela). */
const FACE_VERTS = 468;

/**
 * Quanto a malha é encolhida em direção ao centro da cabeça, POR EIXO (espaço
 * local da cabeça). Os landmarks ficam sobre a pele, mas as hastes passam por
 * FORA da têmpora; sem encolher, a malha engoliria as hastes e elas sumiriam.
 *
 *   X (lateral)   0,90 — ~7 mm nas têmporas. É o mais forte porque armações
 *                 reais vão de 126 a 150 mm: uma de 128 mm tem a haste em
 *                 x = ±64 e precisa ficar fora da malha (a têmpora está em
 *                 ±70 → ±63).
 *   Y (vertical)  0,97 — quase nada: a altura não tem haste para proteger.
 *   Z (frente)    0,98 — ~1,7 mm no nariz, onde ficam as plaquetas. Folga
 *                 pequena de propósito: as plaquetas encostam a 17 mm do plano
 *                 dos olhos, e uma folga grande descola a sombra da pele
 *                 (armação "flutuando").
 */
const SHRINK_X = 0.9;
const SHRINK_Y = 0.97;
const SHRINK_Z = 0.98;

/** Recuo ao longo do raio da câmera (mm): folga para o ruído do Z do MediaPipe. */
const PUSH_BACK_MM = 2;

/**
 * Distância do centro da cabeça até o plano dos CANTOS dos olhos (mm). Era 80
 * quando a referência era a íris, que fica ~9 mm à frente dos cantos.
 */
const HEAD_CENTER_BEHIND_EYES = 71;

/** Suavização do relevo (por vértice, no espaço da cabeça): tira o ruído do Z. */
const VERTEX_SMOOTH = 0.35;

/**
 * Deriva os triângulos da malha a partir das arestas
 * (FaceLandmarker.FACE_LANDMARKS_TESSELATION do tasks-vision).
 *
 * A tesselação é uma triangulação: todo triângulo é um "ciclo de 3" no grafo
 * de arestas. Para cada aresta (a, b) procuramos os vizinhos comuns c.
 *
 * Retorna null se o resultado parecer inválido (menos de 500 triângulos): nese
 * caso a oclusão cai para a casca elíptica simples do palco.
 */
export function buildFaceTriangles(
  edges: { start: number; end: number }[] | null | undefined,
): Uint16Array | null {
  if (!edges || edges.length < 800) return null;

  const adj: Set<number>[] = Array.from({ length: FACE_VERTS }, () => new Set<number>());
  for (const { start, end } of edges) {
    if (start >= FACE_VERTS || end >= FACE_VERTS || start === end) continue;
    adj[start].add(end);
    adj[end].add(start);
  }

  const tris: number[] = [];
  for (let a = 0; a < FACE_VERTS; a++) {
    for (const b of adj[a]) {
      if (b <= a) continue;
      for (const c of adj[b]) {
        if (c <= b) continue;
        if (adj[a].has(c)) tris.push(a, b, c);
      }
    }
  }

  return tris.length >= 500 * 3 ? new Uint16Array(tris) : null;
}

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _qRawInv = new THREE.Quaternion();

export class FaceOccluder {
  readonly group = new THREE.Group();

  private readonly geo = new THREE.BufferGeometry();
  private readonly pos = new Float32Array(FACE_VERTS * 3);
  /** Relevo suavizado, em coordenadas locais da cabeça (mm). */
  private readonly local = new Float32Array(FACE_VERTS * 3);
  private hasLocal = false;

  private readonly depthMesh: THREE.Mesh;
  private readonly shadowMesh: THREE.Mesh;
  private readonly shadowMat: THREE.ShadowMaterial;

  constructor(triangles: Uint16Array) {
    const attr = new THREE.BufferAttribute(this.pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", attr);
    this.geo.setIndex(new THREE.BufferAttribute(triangles, 1));

    // Camada 1: só profundidade. Renderiza ANTES da armação (opaca).
    const depthMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.depthMesh = new THREE.Mesh(this.geo, depthMat);
    this.depthMesh.renderOrder = -3;
    this.depthMesh.frustumCulled = false; // os vértices mudam a cada quadro

    // Camada 2: só a sombra recebida. Renderiza DEPOIS (transparente).
    this.shadowMat = new THREE.ShadowMaterial({
      opacity: 0.34,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.shadowMat.depthWrite = false;
    this.shadowMesh = new THREE.Mesh(this.geo, this.shadowMat);
    this.shadowMesh.receiveShadow = true;
    this.shadowMesh.renderOrder = 3;
    this.shadowMesh.frustumCulled = false;

    this.group.add(this.depthMesh, this.shadowMesh);
    this.group.visible = false;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
    if (!v) this.hasLocal = false; // ao voltar, o relevo recomeça sem "arrasto"
  }

  setShadowOpacity(o: number) {
    this.shadowMat.opacity = o;
  }

  /** Mostra a malha como aramado (depuração da oclusão). */
  setDebug(v: boolean) {
    const m = this.depthMesh.material as THREE.MeshBasicMaterial;
    m.colorWrite = v;
    m.wireframe = v;
    m.color.set(0x66e0ff);
    m.transparent = v;
    m.opacity = v ? 0.45 : 1;
    m.needsUpdate = true;
  }

  /**
   * Reconstrói a malha para o quadro atual.
   *
   * `solved` é a pose bruta deste quadro; `pos`/`quat` são a pose SUAVIZADA que
   * a armação usa. O relevo é suavizado no espaço da cabeça e reposicionado com
   * a pose suavizada — assim malha e armação se movem exatamente juntas e o
   * tremor do rastreamento não cria "vazamentos" nas bordas da oclusão.
   */
  update(
    lm: Vec2[],
    m: ViewMapping,
    solved: SolvedPose,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
  ) {
    if (lm.length < FACE_VERTS) return;

    const zScale = m.srcW * solved.mmPerSrcPx; // Z do MediaPipe -> mm
    _qRawInv.copy(solved.quaternion).invert();

    // Centro da cabeça: atrás dos olhos, ao longo do eixo "frente" do rosto.
    _fwd.set(0, 0, 1).applyQuaternion(solved.quaternion);
    _c.copy(solved.position).addScaledVector(_fwd, -HEAD_CENTER_BEHIND_EYES);

    const alpha = this.hasLocal ? VERTEX_SMOOTH : 1;

    // Centro da cabeça com a pose suavizada (onde a malha será reposicionada).
    _fwd.set(0, 0, 1).applyQuaternion(quat);
    const cSmooth = new THREE.Vector3().copy(pos).addScaledVector(_fwd, -HEAD_CENTER_BEHIND_EYES);

    for (let i = 0; i < FACE_VERTS; i++) {
      const p = lm[i];

      // 1) Landmark -> ponto 3D no raio da câmera, na profundidade correta.
      //    MediaPipe: Z menor = mais perto da câmera.
      landmarkToWorld(p.x, p.y, m, _p);
      const depthMm = solved.distanceMm + (p.z - solved.eyeZ) * zScale;
      _p.multiplyScalar(depthMm / m.depth);

      // 2) Espaço local da cabeça (centro na origem, sem a rotação bruta) e
      //    3) encolhe POR EIXO — as hastes ficam por fora da malha.
      _p.sub(_c).applyQuaternion(_qRawInv);
      _p.x *= SHRINK_X;
      _p.y *= SHRINK_Y;
      _p.z *= SHRINK_Z;

      // 4) Suaviza o relevo: tira o ruído sem criar atraso de movimento.
      const k = i * 3;
      if (alpha === 1) {
        this.local[k] = _p.x;
        this.local[k + 1] = _p.y;
        this.local[k + 2] = _p.z;
      } else {
        this.local[k] += (_p.x - this.local[k]) * alpha;
        this.local[k + 1] += (_p.y - this.local[k + 1]) * alpha;
        this.local[k + 2] += (_p.z - this.local[k + 2]) * alpha;
      }

      // 5) Volta ao mundo com a pose suavizada e recua um pouco do raio.
      _p.set(this.local[k], this.local[k + 1], this.local[k + 2]);
      _p.applyQuaternion(quat).add(cSmooth);
      const len = _p.length();
      if (len > 1e-3) _p.multiplyScalar((len + PUSH_BACK_MM) / len);

      this.pos[k] = _p.x;
      this.pos[k + 1] = _p.y;
      this.pos[k + 2] = _p.z;
    }

    this.hasLocal = true;
    this.geo.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.shadowMat.dispose();
    (this.depthMesh.material as THREE.Material).dispose();
  }
}
