/**
 * stage.ts — palco Three.js do provador (Fase 8).
 *
 * Porta fiel de `src/lib/stage.ts` da referência: renderer sobreposto ao vídeo
 * (transparente), câmera pinhole, ambiente PBR procedural, luzes que imitam o
 * ambiente real (estimativa de luz), casca de oclusão da cabeça, plano que
 * recebe sombra e captura de foto.
 *
 * Unidades: milímetros; câmera na origem olhando para -Z. O eixo +Z aponta
 * PARA a câmera: a frente da armação fica em z ≈ +10…+14 e a nuca em z ≈ −90.
 */
import * as THREE from "three";
import { FaceOccluder, buildFaceTriangles } from "./face-mesh";
import { type GlassesModel } from "./glasses";
import { type SolvedPose, type Vec2, type ViewMapping } from "./tracker";

/**
 * Distância da câmera até o plano auxiliar usado para converter pixels em
 * milímetros. A distância REAL ao rosto é estimada depois pelo IPD.
 */
export const ANCHOR_DEPTH = 1000;

/**
 * Distância da luz principal ao alvo (mm). É constante porque os planos
 * near/far do mapa de sombra foram dimensionados para ela.
 */
const KEY_DISTANCE = 730;

/** Direção inicial da luz principal (alto, levemente à direita, à frente). */
const KEY_DIR_DEFAULT = new THREE.Vector3(0.2, 0.42, 0.88).normalize();

/** Medida de luz amostrada no rosto (ver `sampleLight` no componente). */
export interface LightEstimate {
  r: number; // cor média do rosto, 0–1 (canal vermelho)
  g: number;
  b: number;
  luma: number; // brilho médio, 0–1
  biasX: number; // −1 … +1: de que lado vem a luz (esquerda/direita da tela)
  biasY: number; // −1 … +1: luz de cima (−1) ou de baixo (+1)
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  /** Grupo que recebe a pose do rosto (posição + quaternion + escala). */
  private readonly headAnchor = new THREE.Group();

  private readonly shadowCatcher: THREE.Mesh;
  private readonly occluder: THREE.Group;
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fillLight!: THREE.DirectionalLight;
  private envTexture: THREE.Texture | null = null;

  /** Posição da luz principal relativa ao alvo (mm); muda com a luz estimada. */
  private readonly keyOffset = new THREE.Vector3().copy(KEY_DIR_DEFAULT).multiplyScalar(KEY_DISTANCE);

  /** Malha 3D real do rosto (oclusão + sombra). null até o rastreador carregar. */
  private faceOccluder: FaceOccluder | null = null;
  private faceMeshEnabled = true;

  /** Estado suavizado da iluminação estimada. */
  private light = { k: 1, r: 1, g: 1, b: 1, bx: 0.2, by: 0.4, ready: false };

  private current: GlassesModel | null = null;
  private raf = 0;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true, // necessário para capturar a foto
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Tom "Neutral": preserva a cor real do material. O ACES, pensado para
    // cenas de cinema, esmaece e escurece as cores — sobre uma câmera de vídeo
    // isso faz a armação parecer de outra foto.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 6000);
    this.camera.position.set(0, 0, 0);

    this.envTexture = this.buildEnvironment();
    this.scene.environment = this.envTexture;

    this.buildLights();

    this.headAnchor.name = "head_anchor";
    this.scene.add(this.headAnchor);

    this.occluder = buildHeadOccluder();
    this.headAnchor.add(this.occluder);

    this.shadowCatcher = this.buildShadowCatcher();
    this.headAnchor.add(this.shadowCatcher);

    this.animate();
  }

  /* ----------------------------------------------------------------------- */
  /* Ambiente e luzes                                                        */
  /* ----------------------------------------------------------------------- */

  /**
   * Gera um mapa de ambiente equiretangular em canvas: duas softboxes, uma luz
   * de recorte fria e o chão da bancada. Sem isso, metal e vidro ficam pretos.
   */
  private buildEnvironment(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;

    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#f2ede4");
    sky.addColorStop(0.48, "#b9b2a6");
    sky.addColorStop(0.52, "#4b4a46");
    sky.addColorStop(1, "#222226");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);

    const softbox = (x: number, y: number, r: number, tint: string) => {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, tint);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };

    softbox(140, 70, 110, "rgba(255,255,255,1)");
    softbox(390, 88, 86, "rgba(255,226,183,0.95)"); // recorte quente (âmbar)
    softbox(256, 20, 150, "rgba(232,240,255,0.55)");

    const canvasTex = new THREE.CanvasTexture(c);
    canvasTex.mapping = THREE.EquirectangularReflectionMapping;
    canvasTex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromEquirectangular(canvasTex);
    canvasTex.dispose();
    pmrem.dispose();
    return rt.texture;
  }

  private buildLights() {
    const ambient = new THREE.HemisphereLight(0xfdf6ea, 0x2b2f38, 0.85);
    this.hemiLight = ambient;
    this.scene.add(ambient);

    // Luz principal: é ela que projeta a sombra suave da armação sobre o rosto.
    // A posição e o alvo são atualizados a cada frame em applyPose() para
    // acompanhar o rosto — o volume de sombra é pequeno e precisa cobri-lo.
    const key = new THREE.DirectionalLight(0xfff3e2, 2.1);
    key.position.copy(this.keyOffset);
    this.keyLight = key;
    this.scene.add(key.target);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);

    // Volume de sombra APERTADO em volta do rosto (armação + face ≈ ±170 mm) e
    // com near/far curtos em torno da distância da luz. Um volume grande gasta
    // a resolução do mapa e exige um bias enorme, que descola a sombra da pele
    // (a armação parece flutuar). Aqui: ~4,5 texels por mm.
    const cam = key.shadow.camera as THREE.OrthographicCamera;
    cam.left = -170;
    cam.right = 170;
    cam.top = 130;
    cam.bottom = -130;
    cam.near = KEY_DISTANCE - 320;
    cam.far = KEY_DISTANCE + 320;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.4;
    this.scene.add(key);

    // Preenchimento frio, para o lado sombreado do rosto não ficar preto.
    const fill = new THREE.DirectionalLight(0xcfe2ff, 0.85);
    fill.position.set(-380, -120, 420);
    this.fillLight = fill;
    this.scene.add(fill);

    // Recorte traseiro, separa a armação do fundo.
    const rim = new THREE.DirectionalLight(0xffd9a8, 1.15);
    rim.position.set(-160, 260, -520);
    this.scene.add(rim);
  }

  /**
   * Plana translúcida que recebe sombras. Fica entre as lentes (z ≈ +2) e a
   * casca de oclusão (z ≈ −6), para a sombra cair "no rosto" e continuar
   * visível.
   */
  private buildShadowCatcher(): THREE.Mesh {
    const mat = new THREE.ShadowMaterial({ opacity: 0.26, transparent: true });
    mat.depthWrite = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 260), mat);
    // Na altura dos olhos (z ~ 0): atrás da armação (z ≈ +10…+14) e à frente
    // da casca de oclusão.
    mesh.position.z = 0.5;
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    return mesh;
  }

  /* ----------------------------------------------------------------------- */
  /* API pública                                                             */
  /* ----------------------------------------------------------------------- */

  setGlasses(model: GlassesModel) {
    if (this.current) {
      this.headAnchor.remove(this.current.anchor);
    }
    this.current = model;
    this.headAnchor.add(model.anchor);
    // Começa escondido até o primeiro rosto ser detectado.
    this.headAnchor.visible = false;
  }

  /** Mostra/esconde a armação (some quando nenhum rosto é detectado). */
  setTracked(visible: boolean) {
    this.headAnchor.visible = visible;
    if (!visible) {
      this.faceOccluder?.setVisible(false);
    }
  }

  /* ----------------------------------------------------------------------- */
  /* Malha 3D do rosto (oclusão + sombra)                                    */
  /* ----------------------------------------------------------------------- */

  /**
   * Liga a oclusão pela malha real do rosto. Recebe os triângulos derivados da
   * tesselação do MediaPipe; sem eles continua valendo a casca elíptica e o
   * plano de sombra.
   */
  enableFaceMesh(triangles: Uint16Array) {
    if (this.faceOccluder) return;
    this.faceOccluder = new FaceOccluder(triangles);
    this.scene.add(this.faceOccluder.group);
  }

  get hasFaceMesh() {
    return this.faceOccluder !== null;
  }

  /** Liga/desliga a oclusão pela malha (para comparar ou evitar artefatos). */
  setFaceMeshEnabled(on: boolean) {
    this.faceMeshEnabled = on;
    if (!on) this.faceOccluder?.setVisible(false);
    this.syncShadowCatcher();
  }

  /** Atualiza a malha do rosto para o quadro atual. */
  updateFaceMesh(
    lm: Vec2[],
    mapping: ViewMapping,
    solved: SolvedPose,
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
  ) {
    if (!this.faceOccluder || !this.faceMeshEnabled) return;
    this.faceOccluder.update(lm, mapping, solved, pos, quat);
    this.faceOccluder.setVisible(true);
    this.syncShadowCatcher();
  }

  /** O plano de sombra só vale quando NÃO há malha do rosto para recebê-la. */
  private syncShadowCatcher() {
    const meshActive = this.faceOccluder !== null && this.faceMeshEnabled;
    this.shadowCatcher.visible = !meshActive && !this.occluderDebug;
  }

  private occluderDebug = false;

  /* ----------------------------------------------------------------------- */
  /* Iluminação estimada                                                     */
  /* ----------------------------------------------------------------------- */

  /**
   * Faz a luz da cena acompanhar a luz real do ambiente, medida no rosto:
   *
   *   - brilho   -> intensidade das luzes e do ambiente (sala escura = armação
   *                 escura, em vez de brilhar como num estúdio);
   *   - cor      -> leve tinta (luz quente de lâmpada, fria de janela);
   *   - direção  -> de que lado a luz vem (o lado do rosto mais claro).
   *
   * Aplicada com suavização forte: a estimativa varia de um quadro a outro.
   */
  setLighting(e: LightEstimate) {
    const L = this.light;
    const a = L.ready ? 0.12 : 1;
    L.ready = true;

    // Brilho típico de uma pele bem exposta em sRGB ≈ 0,5.
    const k = THREE.MathUtils.clamp(e.luma / 0.5, 0.4, 1.35);

    // A cor média do rosto é, em boa parte, a cor da pele — não da luz. Por
    // isso só 25% dela entra como tinta, normalizada para não mudar o brilho.
    const lum = Math.max(0.299 * e.r + 0.587 * e.g + 0.114 * e.b, 0.05);
    const tint = (c: number) => THREE.MathUtils.clamp(c / lum, 0.7, 1.35) * 0.25 + 0.75;

    L.k += (k - L.k) * a;
    L.r += (tint(e.r) - L.r) * a;
    L.g += (tint(e.g) - L.g) * a;
    L.b += (tint(e.b) - L.b) * a;
    L.bx += (e.biasX - L.bx) * a;
    L.by += (e.biasY - L.by) * a;

    // Intensidades.
    this.hemiLight.intensity = 0.85 * L.k;
    this.keyLight.intensity = 2.1 * L.k;
    this.fillLight.intensity = 0.85 * L.k;
    this.scene.environmentIntensity = THREE.MathUtils.clamp(0.5 + 0.7 * L.k, 0.7, 1.4);

    // Tinta nas luzes (partindo de um branco levemente quente).
    this.keyLight.color.setRGB(1.0 * L.r, 0.953 * L.g, 0.886 * L.b);
    this.hemiLight.color.setRGB(0.99 * L.r, 0.965 * L.g, 0.918 * L.b);

    // Direção: a luz vem do lado mais claro. Mantém a distância (o volume de
    // sombra foi dimensionado para ela).
    this.keyOffset
      .set(L.bx * 0.85, 0.28 + L.by * 0.55, 0.9)
      .normalize()
      .multiplyScalar(KEY_DISTANCE);

    // Sombras mais marcadas com luz mais dura (direcional forte).
    const hard = Math.min(1, Math.abs(L.bx) * 0.8 + 0.35);
    this.faceOccluder?.setShadowOpacity(0.24 + 0.2 * hard * Math.min(1, L.k));
  }

  /** Aplica a pose resolvida pelo solver ao grupo da armação. */
  applyPose(p: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fitScale: number;
  }) {
    const anchor = this.headAnchor;
    anchor.position.copy(p.position);
    anchor.quaternion.copy(p.quaternion);
    anchor.scale.setScalar(p.fitScale);

    // A luz acompanha a POSIÇÃO do alvo (não a rotação): a iluminação fica
    // fixa no mundo, então girar muda o brilho como na vida real.
    this.keyLight.position.copy(p.position).add(this.keyOffset);
    this.keyLight.target.position.copy(p.position);
    this.keyLight.target.updateMatrixWorld();
  }

  /** Ativa/desativa a visualização das máscaras de oclusão (depuração). */
  setOccluderVisible(visible: boolean) {
    this.occluderDebug = visible;
    this.occluder.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (!m) return;
      m.colorWrite = visible;
      m.wireframe = visible;
      m.opacity = visible ? 0.32 : 1;
      m.transparent = visible;
    });
    this.faceOccluder?.setDebug(visible);
    this.syncShadowCatcher();
  }

  resize(cssW: number, cssH: number) {
    this.renderer.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / Math.max(cssH, 1);
    this.camera.updateProjectionMatrix();
  }

  get fov() {
    return this.camera.fov;
  }

  /** Monta o mapeamento usado pelo solver a partir do estado atual. */
  buildMapping(srcW: number, srcH: number, mirrored: boolean, fit: "cover" | "contain"): ViewMapping {
    return {
      cssW: this.canvas.clientWidth || 1,
      cssH: this.canvas.clientHeight || 1,
      srcW,
      srcH,
      mirrored,
      fit,
      fovDeg: this.camera.fov,
      depth: ANCHOR_DEPTH,
    };
  }

  /** Referência ao modelo atual (para ler `naturalWidth`, `realScale` etc.). */
  get glasses(): GlassesModel | null {
    return this.current;
  }

  /** Textura de ambiente (usada pela armação demo de `glasses.ts`). */
  get environment(): THREE.Texture | null {
    return this.envTexture;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.faceOccluder?.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
  }

  /* ----------------------------------------------------------------------- */
  /* Captura de foto                                                         */
  /* ----------------------------------------------------------------------- */

  /**
   * Compõe a foto final, de baixo para cima:
   *   1. o vídeo;
   *   2. a camada WebGL com a armação.
   * A camada 1 usa o mesmo object-fit e espelhamento da tela, para que tudo
   * fique exatamente onde o usuário está vendo.
   */
  capture(
    source: HTMLVideoElement | HTMLImageElement | null,
    opts: {
      mirrored: boolean;
      fit: "cover" | "contain";
    },
  ): string {
    const cssW = Math.max(1, Math.round(this.canvas.clientWidth));
    const cssH = Math.max(1, Math.round(this.canvas.clientHeight));
    const out = document.createElement("canvas");
    out.width = cssW * 2;
    out.height = cssH * 2;
    const ctx = out.getContext("2d")!;

    ctx.fillStyle = "#12141a";
    ctx.fillRect(0, 0, out.width, out.height);

    const drawFitted = (img: CanvasImageSource, srcW: number, srcH: number) => {
      if (srcW <= 0 || srcH <= 0) return;
      const s =
        opts.fit === "cover"
          ? Math.max(out.width / srcW, out.height / srcH)
          : Math.min(out.width / srcW, out.height / srcH);
      const dw = srcW * s;
      const dh = srcH * s;
      const ox = (out.width - dw) / 2;
      const oy = (out.height - dh) / 2;

      ctx.save();
      if (opts.mirrored) {
        ctx.translate(out.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, ox, oy, dw, dh);
      ctx.restore();
    };

    if (source) {
      const isVideo = source instanceof HTMLVideoElement;
      drawFitted(
        source,
        isVideo ? source.videoWidth : (source as HTMLImageElement).naturalWidth,
        isVideo ? source.videoHeight : (source as HTMLImageElement).naturalHeight,
      );
    }

    // A camada WebGL tem o mesmo aspecto do palco: esticar é exato. O mesmo
    // desfoque leve da tela (0,4 px CSS = 0,8 px aqui, a foto tem 2× a escala).
    ctx.save();
    ctx.filter = "blur(0.8px)";
    ctx.drawImage(this.canvas, 0, 0, out.width, out.height);
    ctx.restore();

    return out.toDataURL("image/jpeg", 0.92);
  }
}

/**
 * Casca anatômica da cabeça que só escreve no buffer de profundidade.
 *
 * Posicionada de modo que a superfície frontal fique em z ≈ −6 — logo atrás do
 * plano das lentes. Se ela ficasse na frente, apagaria as próprias lentes; se
 * ficasse muito atrás, as hastes passariam por cima do rosto.
 */
function buildHeadOccluder(): THREE.Group {
  const group = new THREE.Group();
  group.name = "head_occluder";

  const mat = new THREE.MeshBasicMaterial({
    color: 0x252a33,
    colorWrite: false,
    depthWrite: true,
    transparent: false,
    opacity: 1,
  });

  const add = (geo: THREE.BufferGeometry, pos: THREE.Vector3) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.renderOrder = -1; // garante que a profundidade seja gravada antes
    group.add(mesh);
  };

  // Crânio elipsoidal. A origem do rosto está na linha das pupilas (z = 0),
  // com +Z em direção à câmera.
  //
  //   - superfície frontal em z ≈ −2   -> não apaga lentes nem aros (z > +8);
  //   - meia-largura 59 mm             -> MAIS ESTREITO que as hastes (x ≈ ±63),
  //     que ficam logo por fora. Se o crânio fosse mais largo que as hastes,
  //     elas ficariam DENTRO da casca e sumiriam inteiras, até do lado próximo.
  //
  // Resultado: a haste do lado oposto é escondida pela cabeça quando ela gira;
  // a haste do lado voltado para a câmera continua visível.
  const skull = new THREE.SphereGeometry(1, 40, 28);
  skull.scale(59, 86, 92);
  add(skull, new THREE.Vector3(0, 6, -94));

  return group;
}

/** Reexporta para o componente montar a malha facial com as arestas do tracker. */
export { buildFaceTriangles };
