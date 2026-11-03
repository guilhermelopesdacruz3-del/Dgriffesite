/**
 * glasses.ts — carrega, normaliza e calibra os modelos 3D de óculos (Fase 8).
 *
 * Porta do `src/lib/glasses.ts` da referência, com a diferença central da
 * loja: em vez de upload de arquivo, o `.glb` do produto vem do banco
 * (`Model3D.glbUrl` por produto/variante) — `loadGlassesFromUrl(url)`.
 * A armação de demonstração é construída em código e serve enquanto o
 * produto não tem modelo 3D cadastrado.
 *
 * Cada software exporta diferente (Blender usa Z-up/metros; web usa Y-up/mm;
 * pivôs variados). `setObject()` corrige centro, orientação provável e
 * escala, e os controles manuais resolvem o resto.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Largura nominal de uma armação adulta, em mm (unidade do espaço 3D). */
export const NOMINAL_FRAME_WIDTH = 140;

export interface Calibration {
  scale: number; // multiplicador sobre o tamanho já adaptado ao rosto
  x: number; // deslocamento lateral em mm
  y: number; // deslocamento vertical em mm
  z: number; // aproxima/afasta do rosto em mm
  rotX: number; // graus
  rotY: number;
  rotZ: number;
  /** Gira o modelo 180° em Y (corrige arquivo com a frente para trás). */
  turn: boolean;
  /** Esticamento independente (largura/altura da armação). */
  stretchX: number;
  stretchY: number;
  /** Inclinação pantoscópica (graus): borda de baixo das lentes se aproxima do rosto. */
  tilt: number;
}

/** Inclinação pantoscópica típica de óculos bem ajustados: 6–10°. */
export const DEFAULT_TILT_DEG = 6;

export const DEFAULT_CALIBRATION: Calibration = {
  scale: 1,
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  turn: false,
  stretchX: 1,
  stretchY: 1,
  tilt: DEFAULT_TILT_DEG,
};

/* ---- Anatomia para encaixar a armação (mm), relativa ao PLANO DOS CANTOS
 * DOS OLHOS — o plano que o rastreador usa como referência:
 *
 *   - ponte do nariz (landmark 6)            23 mm à frente do plano
 *   - lado do nariz à altura das plaquetas   17 mm à frente (landmark 188),
 *                                            7 mm abaixo da linha dos olhos
 * As plaquetas apoiam nos LADOS do nariz e ficam ~6 mm atrás da frente da
 * armação, então a frente fica a 17 + 6 = 23 mm. Era 14 mm antes — as
 * plaquetas ficavam DENTRO do nariz e a ponte sumia atrás da malha.
 */

/** Profundidade onde o APOIO NASAL encosta no rosto (mm à frente do plano). */
export const PAD_CONTACT_Z = 17;

/** Reserva quando o modelo não permite medir o apoio nasal. */
export const PAD_BEHIND_FRONT = 6;

/** Altura do apoio nasal em relação ao centro das lentes (mm), reserva. */
export const PAD_Y = -6;

/** Deslocamento vertical padrão (mm): a pupila fica ~4% acima do centro da lente. */
export const FIT_Y_OFFSET = -1.5;

/** Faixa plausível da largura de uma armação adulta, em mm. */
const REAL_WIDTH_MM: [number, number] = [105, 175];

/* ------------------------------------------------------------------------ */
/* Medição da malha                                                         */
/* ------------------------------------------------------------------------ */

/** Percorre vértices do objeto (em espaço de mundo) e entrega cada ponto. */
export function forEachVertex(
  root: THREE.Object3D,
  cb: (v: THREE.Vector3) => void,
  maxSamples = 60000,
) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();

  let total = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const pos = mesh.isMesh ? mesh.geometry?.attributes?.position : undefined;
    if (pos) total += pos.count;
  });
  const stride = Math.max(1, Math.ceil(total / maxSamples));

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      cb(v);
    }
  });
}

export interface Extents {
  min: THREE.Vector3;
  max: THREE.Vector3;
  meanZ: number;
  /** Variância dos vértices em X e Z (onde está a MASSA da malha). */
  varX: number;
  varZ: number;
}

export function measureExtents(root: THREE.Object3D): Extents {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  let sx = 0, sxx = 0, sz = 0, szz = 0, n = 0;
  forEachVertex(root, (v) => {
    min.min(v);
    max.max(v);
    sx += v.x; sxx += v.x * v.x;
    sz += v.z; szz += v.z * v.z;
    n++;
  });
  if (!n) return { min, max, meanZ: 0, varX: 0, varZ: 0 };
  const mx = sx / n;
  const mz = sz / n;
  return {
    min,
    max,
    meanZ: mz,
    varX: sxx / n - mx * mx,
    varZ: szz / n - mz * mz,
  };
}

/* ------------------------------------------------------------------------ */
/* Medidas do próprio modelo: lentes e apoio nasal                           */
/* ------------------------------------------------------------------------ */

/**
 * Esta malha é uma LENTE (vidro)? Procura transparência real (opacidade < 0,98
 * ou transmissão) ou nome típico. `transparent = true` NÃO basta: o glTF marca
 * assim qualquer material com alphaMode BLEND, inclusive a armação inteira.
 * "glass" sozinho casaria com "glasses", por isso o `(?!es)`.
 */
function isLensMesh(mesh: THREE.Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const label = `${mesh.name} ${mats.map((m) => m?.name ?? "").join(" ")}`;
  if (/lens|lente|vidro|cristal|glass(?!es)/i.test(label)) return true;
  return mats.some(
    (m) =>
      !!m &&
      (m.opacity < 0.98 || ((m as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0.05),
  );
}

/** Caixa que envolve todas as lentes, ou null se não houver reconhecíveis. */
function measureLensBox(root: THREE.Object3D): THREE.Box3 | null {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let n = 0;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !isLensMesh(mesh)) return;
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(v);
      n++;
    }
  });

  return n >= 8 && !box.isEmpty() ? box : null;
}

/**
 * Acha o APOIO NASAL: o ponto mais recuado da faixa central da armação
 * (|x - cx| ≤ 14 mm, entre a ponte e a borda das lentes). Usa o 1º percentil
 * para ignorar vértices soltos.
 */
function measureNosePad(
  root: THREE.Object3D,
  cx: number,
  cy: number,
  frontZ: number,
): { z: number; y: number } | null {
  const pts: [number, number][] = [];
  forEachVertex(root, (v) => {
    if (Math.abs(v.x - cx) <= 14 && v.y >= cy - 25 && v.y <= cy + 10) pts.push([v.z, v.y]);
  });
  if (pts.length < 6) return null;

  pts.sort((a, b) => a[0] - b[0]);
  const padZ = pts[Math.floor(pts.length * 0.01)][0];

  // Altura: média dos vértices a até 1,5 mm do ponto mais recuado.
  const near = pts.filter((p) => p[0] <= padZ + 1.5);
  const padY = near.reduce((s, p) => s + p[1], 0) / near.length;

  // Uma armação real tem o apoio entre 2 e 22 mm atrás da frente; fora disso
  // a medida não é confiável.
  const behind = frontZ - padZ;
  if (behind < 2 || behind > 22) return null;

  return { z: padZ, y: padY };
}

/* ------------------------------------------------------------------------ */
/* Modelo                                                                   */
/* ------------------------------------------------------------------------ */

export class GlassesModel {
  /** Grupo que recebe a pose do rosto (posição + rotação). */
  readonly anchor = new THREE.Group();
  /**
   * Grupo do ENCAIXE: inclina a armação em torno do apoio nas plaquetas (como
   * óculos reais) e a assenta na altura certa. Fica entre a pose do rosto e as
   * correções manuais — os sliders somam ao encaixe em vez de substituí-lo.
   */
  readonly fit = new THREE.Group();
  /** Grupo interno que recebe apenas as correções manuais do usuário. */
  readonly holder = new THREE.Group();

  name: string;
  /** Largura da armação em mm (já na escala final exibida, sem calibração). */
  naturalWidth = NOMINAL_FRAME_WIDTH;

  /**
   * true  = arquivo em escala real (metros ou mm) e o tamanho foi mantido;
   * false = escala desconhecida: dimensionada pela largura do rosto.
   */
  realScale = false;

  /** O centro vertical veio das LENTES do modelo (true) ou da faixa frontal (false). */
  lensCentered = false;

  /** O apoio nasal foi medido no modelo (true) ou estimado (false). */
  padMeasured = false;

  /**
   * Ponto de apoio no nariz, no espaço da armação centralizada: é em torno dele
   * que a inclinação pantoscópica gira (y relativo ao centro das lentes).
   */
  readonly contact = new THREE.Vector3(0, PAD_Y, PAD_CONTACT_Z);

  constructor(name = "Armação Demo") {
    this.name = name;
    this.anchor.name = "glasses_anchor";
    this.fit.name = "glasses_fit";
    this.holder.name = "glasses_holder";
    this.anchor.add(this.fit);
    this.fit.add(this.holder);
  }

  /**
   * Encaixe anatômico: inclinação pantoscópica em torno das plaquetas.
   * Girar em torno da origem faria a armação "pendular" no ar — óculos reais
   * giram em torno do ponto onde apoiam no nariz. Para girar em torno de P:
   *     posição = P − R·P     (R = rotação em X)
   */
  protected applyFit(tiltDeg: number) {
    const theta = THREE.MathUtils.degToRad(tiltDeg);
    const pivot = this.contact.clone();

    this.fit.rotation.set(theta, 0, 0);
    const rotated = pivot.clone().applyEuler(this.fit.rotation);
    this.fit.position.copy(pivot).sub(rotated);
    this.fit.position.y += FIT_Y_OFFSET;
  }

  private opacity = 1;

  /** Materiais do modelo, sem repetição. */
  private materials(): THREE.Material[] {
    const seen = new Set<THREE.Material>();
    this.holder.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
        if (m) seen.add(m);
      });
    });
    return [...seen];
  }

  /**
   * Opacidade geral da armação (0–1): ver o rosto por baixo e conferir o
   * encaixe. Materiais (lentes) já transparentes só mudam o alfa; opacos
   * recebem a bandeira `transparent`. `depthWrite` off evita que uma parte
   * semitransparente oculte outra.
   */
  setOpacity(value: number) {
    this.opacity = THREE.MathUtils.clamp(value, 0.05, 1);
    const solid = this.opacity >= 0.999;

    for (const m of this.materials()) {
      m.opacity = this.opacity;
      m.transparent = !solid;
      m.depthWrite = solid;
      m.needsUpdate = true;
    }
  }

  get currentOpacity() {
    return this.opacity;
  }

  /**
   * Instala um objeto 3D no holder, já preparado:
   *   1. corrige modelo deitado de lado (a massa da malha está na frente);
   *   2. descobre qual lado é a FRENTE (hastes se estendem para trás) e gira
   *      180° se estiver invertido;
   *   3. mantém o tamanho real se o arquivo estiver em metros ou mm plausíveis
   *      (105–175); senão normaliza para 140 mm;
   *   4. centraliza pelas LENTES (X pela faixa frontal, Y pelo centro delas);
   *   5. MEDE o apoio nasal e o leva a PAD_CONTACT_Z (onde encosta no nariz).
   */
  setObject(object: THREE.Object3D) {
    this.disposeCurrent();

    // `wrapper` recebe as correções automáticas sem mexer no objeto original.
    const wrapper = new THREE.Group();
    wrapper.name = "glasses_normalized";
    wrapper.add(object);

    // 1) Modelo deitado: a massa da malha frontal é larga em X e fina em Z —
    //    se a variância em Z domina, o modelo está girado 90°.
    let ext = measureExtents(wrapper);
    let size = new THREE.Vector3().subVectors(ext.min, ext.max).negate();
    if (ext.varZ > ext.varX * 1.3) {
      wrapper.rotation.y = Math.PI / 2;
      ext = measureExtents(wrapper);
      size = new THREE.Vector3().subVectors(ext.min, ext.max).negate();
    }

    // 2) Frente x trás: os vértices se concentram na frente (aros, lentes);
    //    as hastes são finas e se estendem para trás. Se a média de Z está do
    //    lado "min", a frente aponta para -Z: gira 180°.
    const mid = (ext.min.z + ext.max.z) / 2;
    if (ext.meanZ < mid) {
      wrapper.rotation.y += Math.PI;
      ext = measureExtents(wrapper);
      size = new THREE.Vector3().subVectors(ext.min, ext.max).negate();
    }

    // 3) Tamanho: glTF padrão é METRO (óculos ≈ 0,14 m). Aceitamos mm (~140).
    //    Outra grandeza não permite saber o tamanho real → normaliza para 140.
    //    A largura é a extensão em X (as hastes NÃO contam).
    const widthUnits = Math.max(size.x, 0.0001);
    const [lo, hi] = REAL_WIDTH_MM;
    let k: number;
    if (widthUnits * 1000 >= lo && widthUnits * 1000 <= hi) {
      k = 1000; // metros -> mm
      this.realScale = true;
    } else if (widthUnits >= lo && widthUnits <= hi) {
      k = 1; // já em mm
      this.realScale = true;
    } else {
      k = NOMINAL_FRAME_WIDTH / widthUnits;
      this.realScale = false;
    }
    wrapper.scale.setScalar(k);
    ext = measureExtents(wrapper);

    // 4) Ancoragem pela faixa frontal (aros + lentes), ignorando as hastes
    //    longas, que deslocariam o centro vertical para baixo.
    const depth = ext.max.z - ext.min.z;
    const slabMin = ext.max.z - Math.max(depth * 0.22, 4);
    const sMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const sMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    forEachVertex(wrapper, (v) => {
      if (v.z < slabMin) return;
      sMin.min(v);
      sMax.max(v);
    });
    const cx = Number.isFinite(sMin.x) ? (sMin.x + sMax.x) / 2 : 0;
    const slabCy = Number.isFinite(sMin.y) ? (sMin.y + sMax.y) / 2 : 0;

    // Centro vertical = centro das LENTES (onde fica o olho). O centro da
    // faixa inteira incluiria a barra de sobrancelha de uma Wayfarer e
    // deixaria as lentes altas demais. Só vale se as lentes tiverem tamanho
    // plausível (18–65 mm de altura) e cobrirem as DUAS (ранB largura > metade).
    const frameW = ext.max.x - ext.min.x;
    const lensBox = measureLensBox(wrapper);
    let cy = slabCy;
    this.lensCentered = false;
    if (lensBox) {
      const lw = lensBox.max.x - lensBox.min.x;
      const lh = lensBox.max.y - lensBox.min.y;
      if (lh >= 18 && lh <= 65 && lw >= frameW * 0.5 && lw <= frameW * 1.02) {
        cy = (lensBox.min.y + lensBox.max.y) / 2;
        this.lensCentered = true;
      }
    }

    // Apoio nasal: medido no modelo; sem medida confiável, 6 mm atrás da frente.
    const pad = measureNosePad(wrapper, cx, cy, ext.max.z);
    this.padMeasured = pad !== null;
    const padZ = pad ? pad.z : ext.max.z - PAD_BEHIND_FRONT;
    const padY = pad ? pad.y - cy : PAD_Y;

    // O apoio nasal vai para onde o nariz realmente está (PAD_CONTACT_Z).
    wrapper.position.set(-cx, -cy, PAD_CONTACT_Z - padZ);
    this.contact.set(0, THREE.MathUtils.clamp(padY, -22, 6), PAD_CONTACT_Z);

    this.holder.clear();
    this.holder.add(wrapper);

    // Largura final em mm, depois da normalização = MEDIDA FÍSICA da peça.
    this.naturalWidth = ext.max.x - ext.min.x;
  }

  /** Aplica os ajustes manuais. As rotações são combinadas em ordem Y-X-Z. */
  applyCalibration(c: Calibration) {
    this.applyFit(c.tilt);
    this.holder.position.set(c.x, c.y, c.z);
    this.holder.rotation.order = "YXZ";
    this.holder.rotation.set(
      THREE.MathUtils.degToRad(c.rotX),
      THREE.MathUtils.degToRad(c.rotY) + (c.turn ? Math.PI : 0),
      THREE.MathUtils.degToRad(c.rotZ),
    );
    this.holder.scale.set(c.scale * c.stretchX, c.scale * c.stretchY, c.scale);
  }

  /** Habilita sombras e texturas PBR em todo o modelo. */
  enableShadows() {
    this.holder.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      // Lente deixa a luz passar: se projetasse sombra sólida, a pele atrás
      // de cada lente ficaria escura. Só a armação projeta sombra.
      const seeThrough = mats.some(
        (m) =>
          !!m &&
          (m.transparent ||
            m.opacity < 0.98 ||
            ((m as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0.05),
      );
      mesh.castShadow = !seeThrough;
      // A armação não recebe a própria sombra: em peças finas gera listras
      // ("acne") sem realismo; a sombra que importa cai na pele.
      mesh.receiveShadow = false;

      mats.forEach((m) => {
        if (m && "envMapIntensity" in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 1.15;
        }
        if (m) m.needsUpdate = true;
      });
    });
  }

  protected disposeCurrent() {
    this.holder.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const mm = m as THREE.MeshStandardMaterial;
        mm.map?.dispose();
        mm.normalMap?.dispose();
        mm.metalnessMap?.dispose();
        mm.roughnessMap?.dispose();
        mm.envMap?.dispose();
        m.dispose();
      });
    });
    this.holder.clear();
  }

  dispose() {
    this.disposeCurrent();
  }
}

/* ------------------------------------------------------------------------ */
/* Carregamento por URL (o .glb vem do banco / do armazenamento da loja)     */
/* ------------------------------------------------------------------------ */

export interface LoadResult {
  model: GlassesModel;
  warnings: string[];
}

/**
 * Baixa e prepara um `.glb` de óculos já cadastrado no produto.
 * `calib` recebe os offsets salvos no admin (Model3D.scale/offsetX/offsetY/
 * offsetZ/rotX/rotY/rotZ) como calibração inicial.
 */
export async function loadGlassesFromUrl(url: string, name: string): Promise<LoadResult> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);

  const warnings: string[] = [];
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const geo = (o as THREE.Mesh).geometry;
    triangles += geo?.index ? geo.index.count / 3 : (geo?.attributes?.position?.count ?? 0) / 3;
  });
  if (triangles === 0) throw new Error("O modelo do produto não contém malha 3D.");
  if (triangles > 500000) {
    warnings.push("Malha muito densa: pode reduzir o FPS em celulares mais fracos.");
  }

  const model = new GlassesModel(name);
  model.setObject(gltf.scene);
  model.enableShadows();

  const mm = Math.round(model.naturalWidth);
  warnings.push(
    model.realScale
      ? `Tamanho real respeitado: armação de ${mm} mm.`
      : `Arquivo sem escala real — largura ajustada ao seu rosto (${mm} mm de referência).`,
  );
  warnings.push(
    `Encaixe: ${model.lensCentered ? "lentes" : "faixa frontal"} centradas nos olhos; ` +
      `apoio nasal ${model.padMeasured ? "medido no modelo" : "estimado"}.`,
  );
  return { model, warnings };
}

/* ------------------------------------------------------------------------ */
/* Armação de demonstração (o estúdio não abre vazio)                        */
/* ------------------------------------------------------------------------ */

/**
 * Armação redonda em metal escovado com lentes fumê — prova imediata enquanto
 * o produto não tem `.glb` cadastrado (ou você só quer experimentar).
 */
export function buildDemoGlasses(envMap: THREE.Texture | null): GlassesModel {
  const model = new GlassesModel("Redonda Clássica (demo)");

  const metal = new THREE.MeshStandardMaterial({
    color: 0xc8892f,
    metalness: 1,
    roughness: 0.28,
    envMap: envMap || undefined,
    envMapIntensity: 1.35,
  });

  // Lente com transparência simples + verniz: `transmission` exige fundo opaco
  // para refratar e fica escura sobre o vídeo (canvas com alpha).
  const lens = new THREE.MeshPhysicalMaterial({
    color: 0x24342c,
    metalness: 0.1,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    envMap: envMap || undefined,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  const lensR = 25;
  const bridgeHalf = 12;

  for (const dir of [-1, 1]) {
    const cx = dir * (lensR + bridgeHalf);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(lensR, 1.15, 16, 64), metal);
    rim.position.x = cx;
    group.add(rim);

    const glass = new THREE.Mesh(new THREE.CircleGeometry(lensR - 0.6, 64), lens);
    glass.position.set(cx, 0, 0);
    group.add(glass);

    // Armação interna fina, dá volume à lente.
    const inner = new THREE.Mesh(new THREE.TorusGeometry(lensR - 2.2, 0.5, 10, 48), metal);
    inner.position.set(cx, 0, -0.6);
    group.add(inner);

    // Haste: curva suave até atrás da orelha.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dir * (lensR * 2 + bridgeHalf - 1), 3, 0),
      new THREE.Vector3(dir * (lensR * 2 + bridgeHalf + 2), 2, -35),
      new THREE.Vector3(dir * (lensR * 2 + bridgeHalf + 1), 1, -85),
      new THREE.Vector3(dir * (lensR * 2 + bridgeHalf - 3), -12, -125),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 1.15, 10, false), metal);
    group.add(arm);

    // Plaquetas ATRÁS das lentes (z negativo = em direção ao rosto).
    const pad = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 12),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.9,
        roughness: 0.35,
        thickness: 1,
        transparent: true,
        opacity: 0.5,
      }),
    );
    pad.position.set(dir * (bridgeHalf + 1.5), -3.5, -4);
    pad.scale.set(0.55, 1.15, 0.7);
    group.add(pad);
  }

  // Ponte superior.
  const bridge = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-bridgeHalf - 2, 6, 1),
        new THREE.Vector3(0, 9, 2),
        new THREE.Vector3(bridgeHalf + 2, 6, 1),
      ]),
      24,
      1.15,
      10,
      false,
    ),
    metal,
  );
  group.add(bridge);

  model.setObject(group);
  model.enableShadows();
  return model;
}
