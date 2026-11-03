"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validators/auth";
import { rateLimit } from "@/lib/rate-limit";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

/** Cria conta (validated no servidor). O login em si é feito via NextAuth. */
export async function registerUser(values: unknown): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const email = parsed.data.email.toLowerCase();

  // Rate limit por IP (barra spam de cadastro)
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`signup:ip:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return { ok: false, error: "Já existe uma conta com este e-mail." };
    }

    // bcrypt: custo 10 é o padrão equilibrado custo/segurança
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    await db.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        // Auditoria (A10): consentimento por omissão é inválido (LGPD) — só
        // pode receber marketing quando a pessoa marca a caixa. Default false.
        marketingOptIn: parsed.data.marketingOptIn ?? false,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("[registerUser]", err);
    return { ok: false, error: "Não foi possível criar a conta. Tente novamente." };
  }
}
