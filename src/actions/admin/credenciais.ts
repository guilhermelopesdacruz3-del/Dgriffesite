"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireAdminForAction } from "@/lib/admin";
import { quoteMelhorEnvio } from "@/lib/shipping-melhor-envio";
import {
  CRED_KEYS,
  credenciaisStatus,
  getMercadoPagoAccessToken,
  getShipFromCep,
  removeSettingValue,
  setSettingValue,
} from "@/lib/credenciais";

/** Campo vazio (senha em branco) = manter o valor atual. */
const saveSchema = z.object({
  mpAccessToken: z.string().trim().max(200).optional().default(""),
  mpWebhookSecret: z.string().trim().max(200).optional().default(""),
  meToken: z.string().trim().max(200).optional().default(""),
  shipFromCep: z.string().trim().max(9).optional().default(""),
  meSandbox: z.boolean().optional().default(false),
});

/** Salva as credenciais do gateway e do frete (o que vier vazio fica como está). */
export async function saveCredenciais(values: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const parsed = saveSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const v = parsed.data;

  try {
    if (v.mpAccessToken) await setSettingValue(CRED_KEYS.mpAccessToken, v.mpAccessToken);
    if (v.mpWebhookSecret) await setSettingValue(CRED_KEYS.mpWebhookSecret, v.mpWebhookSecret);
    if (v.meToken) await setSettingValue(CRED_KEYS.meToken, v.meToken);

    if (v.shipFromCep) {
      const cep = v.shipFromCep.replace(/\D/g, "");
      if (cep.length !== 8) return { ok: false, error: "CEP de origem deve ter 8 dígitos." };
      await setSettingValue(CRED_KEYS.shipFromCep, cep);
    }

    await setSettingValue(CRED_KEYS.meSandbox, v.meSandbox ? "1" : "0");

    await audit(
      { id: guard.user.id, email: guard.user.email },
      "credenciais.salvar",
      "Setting",
      "mp/me",
      { mp: v.mpAccessToken ? "alterado" : "mantido", me: v.meToken ? "alterado" : "mantido", sandbox: v.meSandbox },
    );
    revalidatePath("/admin/ajustes");
    return { ok: true };
  } catch (err) {
    console.error("[credenciais] erro ao salvar:", err);
    return { ok: false, error: "Falha ao salvar — tente novamente." };
  }
}

/** Remove o valor salvo no site (volta a usar a variável da Vercel, se houver). */
export async function limparCredencial(campo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return guard;

  const mapa: Record<string, string> = {
    mpAccessToken: CRED_KEYS.mpAccessToken,
    mpWebhookSecret: CRED_KEYS.mpWebhookSecret,
    meToken: CRED_KEYS.meToken,
    shipFromCep: CRED_KEYS.shipFromCep,
  };
  const key = mapa[campo];
  if (!key) return { ok: false, error: "Campo desconhecido." };

  try {
    await removeSettingValue(key);
    await audit(
      { id: guard.user.id, email: guard.user.email },
      "credenciais.limpar",
      "Setting",
      campo,
    );
    revalidatePath("/admin/ajustes");
    return { ok: true };
  } catch (err) {
    console.error("[credenciais] erro ao limpar:", err);
    return { ok: false, error: "Falha ao limpar — tente novamente." };
  }
}

/** Testa o token do Melhor Envio com uma cotação real Capão da Canoa → POA. */
export async function testarMelhorEnvio(): Promise<
  { ok: true; opcoes: { carrier: string; service: string; price: number; deadline: number | null }[] }
  | { ok: false; error: string }
> {
  const guard = await requireAdminForAction();
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    const destino = "90010000"; // Porto Alegre/RS — teste padrão
    const opcoes = await quoteMelhorEnvio(destino, 100);
    if (opcoes.length === 0) {
      return { ok: false, error: "O Melhor Envio respondeu, mas sem opções — confira o token." };
    }
    return {
      ok: true,
      opcoes: opcoes.slice(0, 4).map((o) => ({
        carrier: o.carrier,
        service: o.service,
        price: o.price,
        deadline: o.deadline,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    return { ok: false, error: `Falha na cotação: ${msg}` };
  }
}

/** Status atual (valores mascarados) para o formulário — só admin. */
export async function statusCredenciais() {
  const guard = await requireAdminForAction();
  if (!guard.ok) return null;

  const s = await credenciaisStatus();
  const mpAtivo = Boolean(await getMercadoPagoAccessToken());
  const meCep = await getShipFromCep();
  return {
    mp: s.mp,
    mpHook: s.mpHook,
    me: s.me,
    meCep,
    meSandbox: s.meSandbox,
    mpAtivo,
  };
}
