/**
 * Carregador do Face Landmarker para o medidor de DP/DNP.
 * O WASM e o modelo `.task` são servidos de /public/mediapipe — zero requisição
 * a terceiros (mesma política do provador virtual).
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const WASM_URL = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/face_landmarker.task";

let instance: Promise<FaceLandmarker> | null = null;

/** Carrega (uma única vez por página) o detector de rosto com íris. */
export function getDnpLandmarker(): Promise<FaceLandmarker> {
  if (!instance) {
    instance = (async () => {
      const mp = await import("@mediapipe/tasks-vision");
      const fileset = await mp.FilesetResolver.forVisionTasks(WASM_URL);
      // GPU é bem mais rápida; em GPUs incompatíveis cai para WASM/CPU.
      const falhas: string[] = [];
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          return await mp.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate },
            runningMode: "VIDEO",
            numFaces: 1,
            // Blendshapes detectam piscadas — amostras inválidas são descartadas.
            outputFaceBlendshapes: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          falhas.push(`${delegate}: ${msg.slice(0, 160)}`);
          console.error(`[dnp] FaceLandmarker falhou via ${delegate}:`, err);
        }
      }
      throw new Error(
        `Detector facial não iniciou — detalhes: ${falhas.join(" · ")}`,
      );
    })().catch((err) => {
      instance = null;
      throw err;
    });
  }
  return instance;
}
