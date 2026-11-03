"use client";

/**
 * ProvadorStudio — componente cliente do estúdio de prova virtual (Fase 8).
 *
 * Porta do `main.ts` da referência para React:
 *   - câmera (getUserMedia) sobre a qual é sobreposto o palco Three.js;
 *   - loop de rastreamento: detect -> solvePose -> suavização -> applyPose;
 *   - estimativa de luz (amostragem do rosto a cada 6 quadros);
 *   - HUD (distância, largura da armação, FPS), espelho, foto para download;
 *   - sliders de calibração (escala, opacidade das lentes, inclinação, X/Y/Z).
 *
 * O `.glb` vem do banco via `props.glbUrl`; sem modelo cadastrado, a armação
 * demo aparece. Todo o processamento de vídeo é LOCAL: nada é enviado.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Check,
  ImageDown,
  Loader2,
  RefreshCcw,
  ScanFace,
  SlidersHorizontal,
  X,
} from "lucide-react";
import * as THREE from "three";
import { saveModel3dCalibrationAction } from "@/actions/admin/models-3d";
import {
  buildDemoGlasses,
  DEFAULT_CALIBRATION,
  DEFAULT_TILT_DEG,
  loadGlassesFromUrl,
  type Calibration,
  type GlassesModel,
} from "@/lib/provador/glasses";
import { Stage } from "@/lib/provador/stage";
import { buildFaceTriangles } from "@/lib/provador/face-mesh";
import { FaceTracker, IpdEstimator, solvePose } from "@/lib/provador/tracker";

/** Constantes de suavização da pose (da referência):
 *  [mínimo, dividendo, máximo] — rápida em movimento brusco, estável em repouso. */
const SMOOTH = { rot: [0.28, 2.4, 0.92], pos: [0.3, 22, 0.92] } as const;

/**
 * Armação padrão de prova (`public/models/frame-padrao.glb`): aparece quando o
 * produto não tem `.glb` próprio cadastrado. Para trocar, substitua o arquivo
 * (otimize com `gltf-transform` — webp + simplify/quantize).
 */
const DEFAULT_FRAME_URL = "/models/frame-padrao.glb";

type Phase = "idle" | "starting" | "running";
type StatusKind = "searching" | "locked" | "error";

interface Hud {
  fps: string;
  dist: string;
  width: string;
}

export interface ProvadorStudioProps {
  productName: string;
  /** `.glb` do produto (Model3D.glbUrl). null = armação de demonstração. */
  glbUrl: string | null;
  /** Calibração inicial salva no admin (Model3D.scale/offsets/rots). */
  calibInit?: {
    scale: number;
    x: number;
    y: number;
    z: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    turn?: boolean;
    stretchX?: number;
    stretchY?: number;
    tilt?: number;
  } | null;
  /** Slug do produto (para o chip "Ver produto" no palco). */
  productSlug?: string | null;
  /**
   * Modo calibração (Fase 7): aberto pelo admin com Identificador do modelo
   * ativo. Exibe "Salvar calibração no produto" — envia os ajustes atuais ao
   * banco para todas as provas futuras.
   */
  calibSave?: { modelId: string } | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function ProvadorStudio({
  productName,
  glbUrl,
  calibInit,
  productSlug,
  calibSave,
}: ProvadorStudioProps) {
  /* ------------------------------ refs de motor ---------------------------- */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stageRef = useRef<Stage | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const modelRef = useRef<GlassesModel | null>(null);
  const ipdRef = useRef<IpdEstimator>(new IpdEstimator());
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const observerRef = useRef<ResizeObserver | null>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lightTickRef = useRef(0);
  const lostSinceRef = useRef(0);
  const fpsRef = useRef({ count: 0, mark: 0, value: 0 });

  /** Pose suavizada entre quadros (transição do solver para o palco). */
  const smoothRef = useRef({
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    scale: 1,
    ready: false,
  });

  /* Estado-driven refs (o loop lê, evita closures obsoletas). */
  const mirroredRef = useRef(true);
  const calibRef = useRef<Calibration>(DEFAULT_CALIBRATION);

  /* ------------------------------- estado UI ------------------------------- */
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<{ kind: StatusKind; text: string }>({
    kind: "searching",
    text: "",
  });
  const [notice, setNotice] = useState<{ text: string; warn: boolean } | null>(null);
  const [hud, setHud] = useState<Hud>({ fps: "—", dist: "—", width: "—" });
  const [mirrored, setMirrored] = useState(true);
  const [occlusion, setOcclusion] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);

  const [baseCalib] = useState<Calibration>(() => ({
    ...DEFAULT_CALIBRATION,
    ...(calibInit
      ? {
          scale: calibInit.scale || 1,
          x: calibInit.x,
          y: calibInit.y,
          z: calibInit.z,
          rotX: calibInit.rotX,
          rotY: calibInit.rotY,
          rotZ: calibInit.rotZ,
          turn: calibInit.turn ?? false,
          stretchX: calibInit.stretchX ?? 1,
          stretchY: calibInit.stretchY ?? 1,
          tilt: calibInit.tilt ?? DEFAULT_TILT_DEG,
        }
      : {}),
  }));
  const [calib, setCalib] = useState<Calibration>(baseCalib);
  const [opacity, setOpacity] = useState(1);

  /* Salvar calibração no produto (modo calibração do admin, Fase 7). */
  const [calibState, setCalibState] = useState<"idle" | "saving" | "ok" | "error">("idle");

  async function saveCalibration() {
    if (!calibSave) return;
    setCalibState("saving");
    const result = await saveModel3dCalibrationAction({
      modelId: calibSave.modelId,
      scale: calib.scale,
      x: calib.x,
      y: calib.y,
      z: calib.z,
      rotX: calib.rotX,
      rotY: calib.rotY,
      rotZ: calib.rotZ,
      turn: calib.turn,
      stretchX: calib.stretchX,
      stretchY: calib.stretchY,
      tilt: calib.tilt,
    });
    setCalibState(result.ok ? "ok" : "error");
  }

  /* ------------------------ efeitos de estado -> motor --------------------- */

  // Ajustes manuais: aplicados ao modelo a cada mudança, e lido pelo loop p/ HUD.
  useEffect(() => {
    calibRef.current = calib;
    modelRef.current?.applyCalibration(calib);
  }, [calib]);

  // Opacidade geral (ver o rosto por baixo e conferir o encaixe).
  useEffect(() => {
    modelRef.current?.setOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  useEffect(() => {
    stageRef.current?.setFaceMeshEnabled(occlusion);
  }, [occlusion]);

  /* ------------------------------- encerrar -------------------------------- */

  const teardown = useCallback(() => {
    runningRef.current = false;
    busyRef.current = false;
    cancelAnimationFrame(rafRef.current);
    observerRef.current?.disconnect();
    observerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    stageRef.current?.dispose();
    stageRef.current = null;
    smoothRef.current.ready = false;
    ipdRef.current.reset(); // a próxima pessoa pode ter outra distância pupilar
  }, []);

  useEffect(() => teardown, [teardown]);

  /* --------------------------------- plugin -------------------------------- */

  /** Mede brilho, cor e direção da luz no rosto, a partir do próprio vídeo. */
  function sampleLight(video: HTMLVideoElement, lm: { x: number; y: number }[]) {
    lightTickRef.current += 1;
    if (lightTickRef.current % 6 !== 0 || lm.length < 455) return;
    const stage = stageRef.current;
    if (!stage) return;

    const lc = lightCanvasRef.current ?? document.createElement("canvas");
    lc.width = 24;
    lc.height = 24;
    lightCanvasRef.current = lc;
    const ctx = lc.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const W = video.videoWidth;
    const H = video.videoHeight;
    const x0 = Math.min(lm[234].x, lm[454].x);
    const x1 = Math.max(lm[234].x, lm[454].x);
    const y0 = lm[10].y;
    const y1 = lm[152].y;

    // Encolhe 12% para não amostrar cabelo e fundo nas bordas.
    const mx = (x1 - x0) * 0.12;
    const my = (y1 - y0) * 0.12;
    const sx = Math.max(0, (x0 + mx) * W);
    const sy = Math.max(0, (y0 + my) * H);
    const sw = Math.min(W - sx, (x1 - x0 - 2 * mx) * W);
    const sh = Math.min(H - sy, (y1 - y0 - 2 * my) * H);
    if (sw < 12 || sh < 12) return;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;

    let r = 0,
      g = 0,
      b = 0,
      left = 0,
      right = 0,
      top = 0,
      bottom = 0;
    for (let py = 0; py < 24; py++) {
      for (let px = 0; px < 24; px++) {
        const o = (py * 24 + px) * 4;
        const lum = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
        r += d[o];
        g += d[o + 1];
        b += d[o + 2];
        if (px < 12) left += lum;
        else right += lum;
        if (py < 12) top += lum;
        else bottom += lum;
      }
    }
    const n = 24 * 24;
    const luma = (left + right) / n / 255;

    // O vídeo é gravado sem espelho; na tela ele aparece espelhado, então o
    // lado "direito" do arquivo é o ESQUERDO da tela.
    const rawBias = (right - left) / (right + left + 1e-6);
    const biasX = clamp((mirroredRef.current ? -rawBias : rawBias) * 2.5, -1, 1);
    const biasY = clamp(((top - bottom) / (top + bottom + 1e-6)) * 2, -1, 1);

    stage.setLighting({ r: r / n / 255, g: g / n / 255, b: b / n / 255, luma, biasX, biasY });
  }

  /* -------------------------------- loop ---------------------------------- */

  const setStatusThen = (next: { kind: StatusKind; text: string }) => {
    // Evita re-render a cada quadro: só atualiza quando o texto muda.
    setStatus((prev) => (prev.text === next.text && prev.kind === next.kind ? prev : next));
  };

  const onTargetLost = (now: number) => {
    stageRef.current?.setTracked(false);
    smoothRef.current.ready = false;

    const quietMs = now - lostSinceRef.current;
    if (quietMs > 450) {
      setStatusThen({
        kind: "searching",
        text:
          quietMs > 6000
            ? "Nenhum rosto — aproxime-se da câmera e melhora a iluminação"
            : "Procurando rosto…",
      });
    }
    setHud((h) => (h.dist === "—" ? h : { fps: h.fps, dist: "—", width: "—" }));
  };

  const loop = () => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop); // agenda o próximo antes de tudo

    const video = videoRef.current;
    const stage = stageRef.current;
    const tracker = trackerRef.current;
    const model = modelRef.current;
    if (busyRef.current || !video || !stage || !tracker || !model) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    busyRef.current = true;
    (async () => {
      try {
        const now = performance.now();

        // FPS para a leitura do instrumento.
        const fps = fpsRef.current;
        fps.count += 1;
        if (now - fps.mark >= 500) {
          fps.value = Math.round((fps.count * 1000) / (now - fps.mark));
          fps.count = 0;
          fps.mark = now;
        }

        const track = await tracker.detect(video, now);
        if (!track || track.landmarks.length < 160) {
          onTargetLost(now);
          return;
        }

        lostSinceRef.current = now;

        const mapping = stage.buildMapping(video.videoWidth, video.videoHeight, mirroredRef.current, "cover");

        // Pose 3D completa: posição, yaw/pitch/roll e distância. O estimador de
        // IPD usa a íris para achar a distância pupilar REAL do usuário.
        const solved = solvePose(track, mapping, ipdRef.current);

        // Escala: arquivo em escala real mantém o tamanho (1×). Escala
        // desconhecida é dimensionada pelo rosto (armação ocupa ~93% da
        // largura de têmpora a têmpora), limitado a ±20% de variação.
        const fit = model.realScale
          ? 1
          : clamp((solved.faceWidthMm * 0.93) / model.naturalWidth, 0.8, 1.25);

        // Suavização adaptativa: quanto maior o movimento, mais rápido responde.
        const smooth = smoothRef.current;
        if (!smooth.ready) {
          smooth.pos.copy(solved.position);
          smooth.quat.copy(solved.quaternion);
          smooth.scale = fit;
          smooth.ready = true;
        } else {
          const angle = smooth.quat.angleTo(solved.quaternion);
          const moved = smooth.pos.distanceTo(solved.position);
          const aRot = clamp(SMOOTH.rot[0] + angle * SMOOTH.rot[1], SMOOTH.rot[0], SMOOTH.rot[2]);
          const aPos = clamp(SMOOTH.pos[0] + moved / SMOOTH.pos[1], SMOOTH.pos[0], SMOOTH.pos[2]);
          smooth.pos.lerp(solved.position, aPos);
          smooth.quat.slerp(solved.quaternion, aRot);
          smooth.scale += (fit - smooth.scale) * 0.3;
        }

        stage.applyPose({ position: smooth.pos, quaternion: smooth.quat, fitScale: smooth.scale });

        // Malha 3D do rosto: esconde as hastes atrás da bochecha/nariz e
        // recebe a sombra da armação sobre a pele.
        stage.updateFaceMesh(track.landmarks, mapping, solved, smooth.pos, smooth.quat);
        stage.setTracked(true);

        // A luz da cena acompanha a luz real medida no rosto.
        sampleLight(video, track.landmarks);

        // HUD (a cada ~6 quadros para não travar a renderização com setState).
        if (fps.value > 0 && lightTickRef.current % 6 === 0) {
          const mm = model.naturalWidth * smooth.scale * calibRef.current.scale;
          setStatusThen({
            kind: "locked",
            text: `Travado · ${fps.value} fps · IPD ${ipdRef.current.value.toFixed(0)} mm`,
          });
          setHud({
            fps: String(fps.value),
            dist: `${(solved.distanceMm / 10).toFixed(0)} cm`,
            width: `${mm.toFixed(0)} mm`,
          });
        }
      } catch {
        /* frame perdido: ignora e segue */
      } finally {
        busyRef.current = false;
      }
    })();
  };

  /* ------------------------------ iniciar/parar ---------------------------- */

  async function start() {
    if (phase === "starting" || phase === "running") return;
    setPhase("starting");
    setNotice(null);
    setHud({ fps: "—", dist: "—", width: "—" });
    setStatus({ kind: "searching", text: "Iniciando…" });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const stage = new Stage(canvasRef.current!);
      stageRef.current = stage;

      // Mede o palco e reage a mudanças de tamanho (janela, rotação do celular).
      const box = boxRef.current!;
      stage.resize(box.clientWidth, box.clientHeight);
      observerRef.current = new ResizeObserver(() => {
        if (stageRef.current && boxRef.current) {
          stageRef.current.resize(boxRef.current.clientWidth, boxRef.current.clientHeight);
        }
      });
      observerRef.current.observe(box);

      // Modelo do produto (do banco) ou armação padrão da loja.
      let model: GlassesModel | null = null;
      const warn: string[] = [];
      if (glbUrl) {
        try {
          const res = await loadGlassesFromUrl(glbUrl, productName);
          model = res.model;
          warn.push(...res.warnings);
        } catch (err) {
          console.error("[provador] Falha ao carregar o .glb do produto:", err);
          warn.push("O modelo 3D do produto não carregou — usando a armação padrão da loja.");
        }
      }
      if (!model) {
        // Armação padrão (`public/models/frame-padrao.glb`). O modelo
        // procedural de demo só entra se nem ela carregar.
        try {
          model = (await loadGlassesFromUrl(DEFAULT_FRAME_URL, "Armação padrão")).model;
        } catch (err) {
          console.error("[provador] Falha ao carregar a armação padrão:", err);
          model = buildDemoGlasses(stage.environment);
          warn.push("Exibindo armação de demonstração (padrão indisponível).");
        }
      }
      model.applyCalibration(calibRef.current);
      stage.setGlasses(model);
      modelRef.current = model;
      model.setOpacity(opacity);
      setWarnings(warn);

      // Rastreador facial (o modelo .task é baixado uma vez e fica em cache).
      const tracker = (trackerRef.current ??= new FaceTracker());
      if (!tracker.backendType) {
        const backend = await tracker.init();
        if (!backend) throw new Error(tracker.loadError ?? "Rastreador facial indisponível.");
      }

      // Oclusão pela malha real do rosto (derivada da tesselação do MediaPipe).
      const tris = buildFaceTriangles(tracker.faceEdges);
      if (tris) stage.enableFaceMesh(tris);
      stage.setFaceMeshEnabled(occlusion);

      runningRef.current = true;
      lostSinceRef.current = performance.now();
      setPhase("running");
      setStatus({ kind: "searching", text: "Procurando rosto…" });
      loop();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      let msg = "Falha ao iniciar o provador. Tente recarregar a página.";
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        msg = "Acesso à câmera negado. Permita o uso da câmera nas configurações do navegador e tente de novo.";
      } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
        msg = "Nenhuma câmera compatível foi encontrada neste aparelho.";
      } else if (e?.name === "NotReadableError") {
        msg = "A câmera está em uso por outro aplicativo. Feche-o e tente de novo.";
      } else if (e?.message) {
        msg = e.message;
      }
      setNotice({ text: msg, warn: true });
      setStatus({ kind: "error", text: "Indisponível" });
      teardown();
      setPhase("idle");
    }
  }

  function stop() {
    teardown();
    setPhase("idle");
    setStatus({ kind: "searching", text: "" });
    setNotice(null);
  }

  function capture() {
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!stage || !video) return;
    const dataUrl = stage.capture(video, { mirrored: mirroredRef.current, fit: "cover" });
    setPhoto(dataUrl);
  }

  const set = <K extends keyof Calibration>(key: K, value: Calibration[K]) =>
    setCalib((c) => ({ ...c, [key]: value }));

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="select-none">
      <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-950 shadow-xl">
        <div ref={boxRef} className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
          {/* Vídeo da câmera (fundo do palco). */}
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: mirrored && phase === "running" ? "scaleX(-1)" : undefined,
              opacity: phase === "running" ? 1 : 0,
            }}
          />
          {/* Camada WebGL com a armação (na mesma área do vídeo). */}
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* Sobrepositórios conforme a fase. */}
          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/90 p-6 text-center">
              <ScanFace className="text-accent-400" size={44} strokeWidth={1.5} aria-hidden />
              <div>
                <p className="font-serif text-2xl text-white">
                  Experimentar {glbUrl ? productName : "no provador"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-stone-400">
                  Ative a câmera para ver a armação acompanhar seu rosto em tempo real. O vídeo é
                  processado 100% no seu aparelho — nada é gravado nem enviado.
                </p>
              </div>
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-6 py-3 font-semibold text-white transition hover:bg-accent-500"
              >
                <Camera size={18} aria-hidden />
                Ativar câmera
              </button>
              {!glbUrl && (
                <p className="text-xs text-stone-500">
                  Prova com a armação padrão da loja — quando o produto tiver
                  modelo 3D cadastrado, a própria armação dele aparece aqui.
                </p>
              )}
            </div>
          )}

          {phase === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-950/90 text-center">
              <Loader2 className="animate-spin text-accent-400" size={32} aria-hidden />
              <p className="text-sm text-stone-300">
                Ativando a câmera e carregando o rastreador facial…
              </p>
              <p className="text-xs text-stone-500">O navegador pedirá permissão de acesso.</p>
            </div>
          )}

          {phase === "running" && (
            <>
              {/* Identificação do produto (topo esquerda). */}
              <div className="absolute left-3 top-3 flex max-w-[60%] flex-col items-start gap-2">
                <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-stone-950/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                  <span className="truncate">{productName}</span>
                  {productSlug && (
                    <Link
                      href={`/produtos/${productSlug}`}
                      className="shrink-0 text-accent-300 underline underline-offset-2"
                    >
                      Ver produto
                    </Link>
                  )}
                </span>
              </div>

              {/* Instrumento de leitura + ações (topo direita). */}
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full bg-stone-950/70 px-3 py-1.5 text-[11px] font-medium text-stone-200 backdrop-blur sm:flex">
                  <span>
                    Dist <strong className="font-mono">{hud.dist}</strong>
                  </span>
                  <span aria-hidden className="text-stone-600">·</span>
                  <span>
                    Larg <strong className="font-mono">{hud.width}</strong>
                  </span>
                  <span aria-hidden className="text-stone-600">·</span>
                  <span>
                    <strong className="font-mono">{hud.fps}</strong> fps
                  </span>
                </div>
                <button
                  type="button"
                  tabIndex={0}
                  aria-pressed={mirrored}
                  onClick={() => setMirrored((m) => !m)}
                  className="rounded-full bg-stone-950/70 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-stone-800"
                >
                  Espelho
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-full bg-stone-950/70 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-stone-800"
                >
                  Encerrar
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  aria-label="Salvar foto do provador"
                  onClick={capture}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 transition hover:bg-stone-200"
                >
                  <Camera size={14} aria-hidden />
                  Foto
                </button>
              </div>

              {/* Estado do rastreamento (rodapé). */}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-950/70 px-4 py-2 text-xs text-stone-100 backdrop-blur">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${
                    status.kind === "locked"
                      ? "bg-emerald-400"
                      : status.kind === "error"
                        ? "bg-red-400"
                        : "animate-pulse bg-amber-300"
                  }`}
                />
                {status.text}
              </div>

              {notice && (
                <div className="absolute inset-x-4 top-14 flex items-start gap-2 rounded-xl bg-red-950/90 px-4 py-3 text-sm text-red-100 backdrop-blur">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  {notice.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Painel de ajustes + alertas (abaixo do palco). */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 md:p-6">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={panelOpen}
        >
          <span className="flex items-center gap-2 font-medium">
            <SlidersHorizontal size={18} className="text-stone-500" aria-hidden />
            Ajustes de encaixe
          </span>
          <span className="text-xs text-stone-500">{panelOpen ? "ocultar" : "mostrar"}</span>
        </button>

        {panelOpen && (
          <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Slider
              label="Escala"
              value={calib.scale}
              display={calib.scale.toFixed(2)}
              min={0.4}
              max={2.2}
              step={0.02}
              onChange={(v) => set("scale", v)}
            />
            <Slider
              label="Opacidade das lentes"
              value={opacity * 100}
              display={`${Math.round(opacity * 100)}%`}
              min={15}
              max={100}
              step={5}
              onChange={(v) => setOpacity(v / 100)}
            />
            <Slider
              label="Inclinação (pantoscópica)"
              value={calib.tilt}
              display={`${calib.tilt.toFixed(1)}°`}
              min={0}
              max={16}
              step={0.5}
              onChange={(v) => set("tilt", v)}
            />
            <Slider
              label="Ajuste lateral (X)"
              value={calib.x}
              display={`${calib.x.toFixed(1)} mm`}
              min={-40}
              max={40}
              step={0.5}
              onChange={(v) => set("x", v)}
            />
            <Slider
              label="Ajuste vertical (Y)"
              value={calib.y}
              display={`${calib.y.toFixed(1)} mm`}
              min={-40}
              max={40}
              step={0.5}
              onChange={(v) => set("y", v)}
            />
            <Slider
              label="Ajuste frontal (Z)"
              value={calib.z}
              display={`${calib.z.toFixed(1)} mm`}
              min={-60}
              max={60}
              step={0.5}
              onChange={(v) => set("z", v)}
            />

            <div className="col-span-full mt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => set("turn", !calib.turn)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  calib.turn
                    ? "border-accent-600 bg-accent-50 text-accent-700"
                    : "border-stone-300 text-stone-700 hover:border-stone-400"
                }`}
              >
                Inverter frente / verso
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalib(baseCalib);
                  setCalibState("idle");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400"
              >
                <RefreshCcw size={14} aria-hidden />
                Redefinir ajustes
              </button>
              <button
                type="button"
                onClick={() => {
                  setOcclusion((o) => !o);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  occlusion
                    ? "border-accent-600 bg-accent-50 text-accent-700"
                    : "border-stone-300 text-stone-700 hover:border-stone-400"
                }`}
              >
                Oclusão do rosto: {occlusion ? "ligada" : "desligada"}
              </button>
            </div>

            {calibSave && glbUrl && (
              <div className="col-span-full mt-2 rounded-xl border border-accent-600/40 bg-accent-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={saveCalibration}
                    disabled={calibState === "saving"}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:opacity-60"
                  >
                    <Check size={15} aria-hidden />
                    {calibState === "saving" ? "Salvando…" : "Salvar calibração no produto"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalib(DEFAULT_CALIBRATION);
                      setCalibState("idle");
                    }}
                    className="cursor-pointer text-xs text-stone-500 underline underline-offset-2 hover:text-ink"
                  >
                    zerar calibração própria
                  </button>
                  {calibState === "ok" && (
                    <span className="text-xs font-medium text-emerald-700">
                      Salva ✓ — todos os clientes vêm com esse encaixe no provador.
                    </span>
                  )}
                  {calibState === "error" && (
                    <span className="text-xs font-medium text-red-700">
                      Erro ao salvar — faça login como admin e tente novamente.
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-stone-600">
                  Modo calibração: os ajustes acima (escala, posição, rotações,
                  esticamento e inclinação) ficam gravados para este produto.
                  A barra desaparece para os clientes.
                </p>
              </div>
            )}

            {warnings.length > 0 && phase === "running" && (
              <ul className="col-span-full list-inside list-disc text-xs text-stone-500">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Modal da foto capturada. */}
      {photo && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-stone-950/90 p-6">
          <button
            type="button"
            aria-label="Fechar foto"
            onClick={() => setPhoto(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X size={20} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={`Foto do provador com ${productName}`}
            className="max-h-[72vh] rounded-xl border border-stone-700 shadow-2xl"
          />
          <div className="flex gap-3">
            <a
              href={photo}
              download={`provador-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`}
              className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-500"
            >
              <ImageDown size={16} aria-hidden />
              Baixar foto
            </a>
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="rounded-full border border-stone-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/* Slider de ajuste                                                            */
/* --------------------------------------------------------------------------- */

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        {label}
        <span className="font-mono text-xs text-stone-500">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-accent-600"
      />
    </label>
  );
}
