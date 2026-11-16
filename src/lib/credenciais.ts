/**
 * Credenciais e parâmetros de operação editáveis dentro do site (/admin/ajustes).
 *
 * Prioridade: 1) banco (Setting) — editado no painel; 2) variável de ambiente
 * (Vercel); 3) default. Assim o dono troca o token do gateway/frete pelo site
 * sem precisar mexer na Vercel, e o valor antigo do .env continua funcionando
 * como reserva.
 */
import { db } from "@/lib/db";

export const CRED_KEYS = {
  mpAccessToken: "mpAccessToken",
  mpWebhookSecret: "mpWebhookSecret",
  meToken: "meToken",
  meSandbox: "meSandbox",
  shipFromCep: "shipFromCep",
} as const;

export async function getSettingValue(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key }, select: { value: true } });
  return row?.value?.trim() || null;
}

export async function setSettingValue(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function removeSettingValue(key: string): Promise<void> {
  await db.setting.deleteMany({ where: { key } });
}

/** De onde veio o valor — para exibir no painel ("salvo no site" vs Vercel). */
export type CredSource = "site" | "env" | "nao-configurado";

async function resolve(
  key: string,
  envValue: string | undefined,
): Promise<{ value: string | null; source: CredSource }> {
  const fromDb = await getSettingValue(key);
  if (fromDb) return { value: fromDb, source: "site" };
  if (envValue) return { value: envValue, source: "env" };
  return { value: null, source: "nao-configurado" };
}

// ---------- Mercado Pago ----------
export async function getMercadoPagoAccessToken(): Promise<string | null> {
  return (await resolve(CRED_KEYS.mpAccessToken, process.env.MERCADO_PAGO_ACCESS_TOKEN)).value;
}
export async function getMercadoPagoWebhookSecret(): Promise<string | null> {
  return (await resolve(CRED_KEYS.mpWebhookSecret, process.env.MERCADO_PAGO_WEBHOOK_SECRET)).value;
}

// ---------- Melhor Envio ----------
export async function getMelhorEnvioToken(): Promise<string | null> {
  return (await resolve(CRED_KEYS.meToken, process.env.MELHOR_ENVIO_TOKEN)).value;
}
export async function getMelhorEnvioBase(): Promise<string> {
  const sandbox = await getSettingValue(CRED_KEYS.meSandbox);
  if (sandbox === "1") return "https://sandbox.melhorenvio.com.br";
  if (sandbox === "0") return "https://www.melhorenvio.com.br";
  return process.env.MELHOR_ENVIO_BASE ?? "https://www.melhorenvio.com.br";
}
export async function getShipFromCep(): Promise<string> {
  const v = (await resolve(CRED_KEYS.shipFromCep, process.env.SHIP_FROM_CEP)).value;
  return (v ?? "95555000").replace(/\D/g, "");
}

/** Resumo para o painel: estado de cada credencial (nunca o valor completo). */
export async function credenciaisStatus() {
  const [mp, mpHook, me, meCep, meBase] = await Promise.all([
    resolve(CRED_KEYS.mpAccessToken, process.env.MERCADO_PAGO_ACCESS_TOKEN),
    resolve(CRED_KEYS.mpWebhookSecret, process.env.MERCADO_PAGO_WEBHOOK_SECRET),
    resolve(CRED_KEYS.meToken, process.env.MELHOR_ENVIO_TOKEN),
    resolve(CRED_KEYS.shipFromCep, process.env.SHIP_FROM_CEP),
    getMelhorEnvioBase(),
  ]);
  return {
    mp: { ...mp, masked: mp.value ? maskSecret(mp.value) : null },
    mpHook: { ...mpHook, masked: mpHook.value ? maskSecret(mpHook.value) : null },
    me: { ...me, masked: me.value ? maskSecret(me.value) : null },
    meCep: { ...meCep, masked: meCep.value ? `${meCep.value.slice(0, 5)}-${meCep.value.slice(5)}` : null },
    meSandbox: meBase.includes("sandbox"),
  };
}

/** Nunca devolve o valor completo para a tela. */
export function maskSecret(v: string): string {
  if (v.length <= 10) return "•".repeat(Math.max(4, v.length - 2)) + v.slice(-2);
  return `${v.slice(0, 6)}••••••••${v.slice(-4)}`;
}
