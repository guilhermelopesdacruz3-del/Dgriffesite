"use client";

/**
 * Medidor de DP (distância pupilar) pela câmera — integração do app
 * "medidor DNP" do lojista à loja. Fluxo:
 *  1. Cliente libera a câmera e se posiciona (guias na tela)
 *  2. Medição automática: ~1,8 s estável + ≥20 amostras válidas (mediana)
 *  3. Resultado OD/OE/DP salvo no aparelho (localStorage) e usado na compra
 *     da armação "com lentes de grau" — vai para o pedido junto da receita.
 *
 * Nenhum vídeo/imagem sai do aparelho: tudo roda local (MediaPipe WASM local).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, RotateCcw, Ruler } from "lucide-react";
import { getDnpLandmarker } from "@/lib/dnp-meter";
import {
  analyzeFace,
  DEFAULT_IRIS_MM,
  fmtNumber,
  median,
  roundHalf,
  stdDev,
  type DnpResult,
  type FrameReading,
  type Landmark,
  type Metrics,
} from "@/lib/dnp";
import { storeConfig } from "@/lib/config";

const STABLE_MS = 1800; // tempo estável para concluir
const MIN_SAMPLES = 20; // amostras válidas mínimas na janela
const MAX_STD_MM = 0.6; // desvio máximo (mm) p/ considerar estável
const UI_INTERVAL_MS = 120;

/** Chave usada pela PDP/carrinho para ler a última medida. */
export const DNP_STORAGE_KEY = "dgriffe.dnp";

export interface DnpStored {
  od: number;
  oe: number;
  dp: number;
  at: string; // ISO
}

export function readStoredDnp(): DnpStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DNP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DnpStored;
    return parsed && typeof parsed.dp === "number" ? parsed : null;
  } catch {
    return null;
  }
}

type Status = "idle" | "loading" | "running" | "done" | "error";

interface Sample {
  od: number;
  oe: number;
  dp: number;
}

type Landmarker = Awaited<ReturnType<typeof getDnpLandmarker>>;

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError")
      return "Câmera bloqueada. Clique no cadeado 🔒 na barra de endereço do site, mude “Câmera” para “Permitir”, recarregue a página e tente de novo. (Se o navegador perguntar, toque em “Permitir”.)";
    if (err.name === "NotFoundError") return "Nenhuma câmera foi encontrada neste dispositivo.";
    if (err.name === "NotReadableError") return "A câmera está em uso por outro aplicativo.";
  }
  return err instanceof Error ? err.message : "Não foi possível iniciar a medição.";
}

/** Desenha guias sobre o vídeo (espelhado, modo selfie). */
function drawOverlay(canvas: HTMLCanvasElement, reading: FrameReading | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!reading) return;

  const { geo, issues } = reading;
  const ok = issues.length === 0;
  const accent = ok ? "#34d399" : "#fbbf24";
  const W = canvas.width;
  const H = canvas.height;
  const mx = (x: number) => W - x;

  // Linha média (ponte do nariz)
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx(geo.midX), 0);
  ctx.lineTo(mx(geo.midX), H);
  ctx.stroke();
  ctx.restore();

  // Linha entre as duas pupilas (DP)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mx(geo.odIris.x), geo.odIris.y);
  ctx.lineTo(mx(geo.oeIris.x), geo.oeIris.y);
  ctx.stroke();

  // Distância de cada pupila até a linha média (DNP)
  for (const [iris, midX] of [
    [geo.odIris, geo.midX],
    [geo.oeIris, geo.midX],
  ] as const) {
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx(iris.x), iris.y);
    ctx.lineTo(mx(midX), iris.y);
    ctx.stroke();
    ctx.restore();
  }

  // Círculos das íris
  for (const [iris, r] of [
    [geo.odIris, geo.odRadius],
    [geo.oeIris, geo.oeRadius],
  ] as const) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx(iris.x), iris.y, Math.max(2, r), 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function DnpMeter() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const samplesRef = useRef<Sample[]>([]);
  const windowStartRef = useRef(0);
  const lastUiRef = useRef(0);
  const landmarkerRef = useRef<Landmarker | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<Metrics | null>(null);
  const [result, setResult] = useState<DnpResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Medida anterior salva neste aparelho (se houver)
  useEffect(() => {
    const s = readStoredDnp();
    if (s) {
      setResult({ id: "stored", createdAt: Date.parse(s.at), od: s.od, oe: s.oe, dp: s.dp, samples: 0 });
      setStatus("done");
    }
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  function finish(samples: Sample[]) {
    stop();
    const od = median(samples.map((s) => s.od));
    const oe = median(samples.map((s) => s.oe));
    const dp = median(samples.map((s) => s.dp));
    const res: DnpResult = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      od: roundHalf(od),
      oe: roundHalf(oe),
      dp: roundHalf(dp),
      samples: samples.length,
    };
    setResult(res);
    try {
      const stored: DnpStored = { od: res.od, oe: res.oe, dp: res.dp, at: new Date().toISOString() };
      window.localStorage.setItem(DNP_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* armazenamento indisponível */
    }
    setStatus("done");
  }

  const loop = useCallback(function loop() {
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || !runningRef.current || video.readyState < 2) return;

    const now = performance.now();
    const detect = landmarker.detectForVideo(video, now);
    const lm = detect.faceLandmarks?.[0];
    const blend = detect.faceBlendshapes?.[0];
    const blinking =
      blend?.categories?.some((c) => c.categoryName?.endsWith("eyeBlink") && c.score > 0.5) ?? false;

    const W = video.videoWidth;
    const H = video.videoHeight;
    if (W && H && (canvas.width !== W || canvas.height !== H)) {
      canvas.width = W;
      canvas.height = H;
    }

    if (!lm || lm.length < 478) {
      drawOverlay(canvas, null);
      samplesRef.current = [];
      windowStartRef.current = 0;
      if (now - lastUiRef.current > UI_INTERVAL_MS) {
        lastUiRef.current = now;
        setIssues(["Nenhum rosto detectado — posicione-se na frente da câmera"]);
        setProgress(0);
      }
      return;
    }

    const reading = analyzeFace(lm as Landmark[], W, H, DEFAULT_IRIS_MM, blinking);
    drawOverlay(canvas, reading);
    const ok = reading.issues.length === 0;

    if (now - lastUiRef.current > UI_INTERVAL_MS) {
      lastUiRef.current = now;
      setIssues(reading.issues);
      setLive(reading.metrics);
    }

    if (!ok) {
      samplesRef.current = [];
      windowStartRef.current = 0;
      if (now - lastUiRef.current > UI_INTERVAL_MS) setProgress(0);
      return;
    }

    // Janela de estabilidade: acumula amostras válidas e conclui quando
    // tempo + quantidade + dispersão ficam dentro do padrão óptico.
    if (windowStartRef.current === 0) windowStartRef.current = now;
    const samples = samplesRef.current;
    samples.push({ od: reading.metrics.od, oe: reading.metrics.oe, dp: reading.metrics.dp });

    const elapsed = now - windowStartRef.current;
    const enough = samples.length >= MIN_SAMPLES;
    const std = enough ? stdDev(samples.map((s) => s.dp)) : Number.POSITIVE_INFINITY;
    const stable = elapsed >= STABLE_MS && std <= MAX_STD_MM;
    if (now - lastUiRef.current > UI_INTERVAL_MS) {
      lastUiRef.current = now;
      setProgress(Math.min(1, elapsed / STABLE_MS) * (stable ? 1 : 0.9) + (enough ? 0.05 : 0));
    }
    if (stable) finish(samples);
  }, []);

  async function start() {
    setError(null);
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      landmarkerRef.current = await getDnpLandmarker();

      samplesRef.current = [];
      windowStartRef.current = 0;
      runningRef.current = true;
      setStatus("running");
      loop();
    } catch (err) {
      stop();
      setStatus("error");
      setError(describeError(err));
    }
  }

  function reset() {
    stop();
    setResult(null);
    setSaved(false);
    setProgress(0);
    setLive(null);
    setIssues([]);
    setStatus("idle");
    try {
      window.localStorage.removeItem(DNP_STORAGE_KEY);
    } catch {
      /* ignora */
    }
  }

  const busy = status === "loading";
  const done = status === "done";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Câmera */}
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-900">
        <div className="relative aspect-video bg-stone-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full scale-x-[-1] object-cover ${status === "running" || status === "done" ? "opacity-100" : "opacity-0"}`}
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {status === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <Ruler className="h-10 w-10 text-stone-400" aria-hidden="true" />
              <p className="max-w-sm text-sm text-stone-300">
                Meça sua <strong className="text-white">DP</strong> (distância entre as pupilas)
                com a câmera — o número que o óptico precisa para montar suas lentes.
              </p>
              <button
                onClick={start}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-700"
              >
                <Camera size={18} aria-hidden="true" /> Ligar câmera e medir
              </button>
              <p className="text-xs text-stone-500">
                A imagem não sai do seu aparelho — medição 100% local.
              </p>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone-300">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
              <p className="text-sm">Preparando câmera e detector…</p>
            </div>
          )}

          {status === "running" && (
            <div className="absolute inset-x-4 bottom-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-[width] duration-150"
                  style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }}
                />
              </div>
              {issues.length > 0 ? (
                <p className="mt-2 rounded-xl bg-amber-400/90 px-3 py-2 text-center text-xs font-medium text-stone-900">
                  {issues[0]}
                </p>
              ) : (
                <p className="mt-2 rounded-xl bg-emerald-400/90 px-3 py-2 text-center text-xs font-medium text-stone-900">
                  Ótimo! Mantenha a posição…
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resultado / instruções */}
      <div className="space-y-4">
        {live && status === "running" && (
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Ao vivo</p>
            <p className="mt-2 flex justify-between">
              <span className="text-stone-500">DP total</span>
              <span className="font-semibold">{fmtNumber(live.dp)} mm</span>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">OD (direito)</span>
              <span>{fmtNumber(live.od)} mm</span>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">OE (esquerdo)</span>
              <span>{fmtNumber(live.oe)} mm</span>
            </p>
          </div>
        )}

        {done && result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-2 font-serif text-lg font-semibold text-stone-900">
              <CheckCircle2 size={20} className="text-emerald-600" aria-hidden="true" />
              {result.samples > 0 ? "Medição concluída" : "Sua última medida"}
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-stone-500">DP total</dt>
                <dd className="font-semibold">{fmtNumber(result.dp)} mm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Olho direito (OD)</dt>
                <dd>{fmtNumber(result.od)} mm</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Olho esquerdo (OE)</dt>
                <dd>{fmtNumber(result.oe)} mm</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSaved(true);
                  router.back();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-700"
              >
                {saved ? "Medida salva ✓" : "Usar esta medida na compra"}
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50"
              >
                <RotateCcw size={15} aria-hidden="true" /> Medir de novo
              </button>
            </div>
            <p className="mt-3 text-xs text-stone-500">
              A medida fica salva neste aparelho e aparece na página do produto quando
              você marcar “com lentes de grau”. O óptico confere tudo junto com a receita.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Não foi possível medir</p>
            <p className="mt-1">{error}</p>
            <button
              onClick={reset}
              className="mt-3 rounded-xl bg-white px-4 py-2 font-semibold text-stone-700 ring-1 ring-stone-200"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            <p className="font-semibold text-stone-900">Como funciona</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Fique a ~50 cm da câmera, em local claro.</li>
              <li>Olhe fixamente para a lente da câmera.</li>
              <li>A medição termina sozinha em ~2 segundos.</li>
            </ol>
            <p className="mt-3 text-xs">
              Dica: a {storeConfig.name} confere a DP junto com a receita antes de montar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
