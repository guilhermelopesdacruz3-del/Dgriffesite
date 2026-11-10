"use server";

/**
 * Fase 11 — "Esqueci minha senha" autosserviço (auditoria A17).
 *
 * Fluxo em duas etapas:
 *   1. requestPasswordReset(e-mail): gera token de 256 bits, guarda SÓ o hash
 *      (SHA-256) com validade de 1 hora e envia o link por e-mail. A resposta
 *      é SEMPRE positiva — nunca revela se o e-mail tem conta (anti-enumeração).
 *   2. confirmPasswordReset(token, novaSenha): valida hash + expiração, grava
 *      o hash bcrypt da nova senha e limpa o token (uso único).
 *
 * Segurança: rate limit no IP e no e-mail, token de uso único, mensagens
 * invariáveis, nenhuma PII em log. Sessões JWT já abertas seguem válidas
 * (estrutura do NextAuth jwt) — não há como "derrubar" um JWT emitido antes.
 */
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail, layoutMail, escapeHtml } from "@/lib/email";
import { storeConfig } from "@/lib/config";
import { passwordResetRequestSchema, passwordResetConfirmSchema } from "@/lib/validators/auth";

export type ResetActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Resposta padrão da 1ª etapa — idêntica exista ou não contar uma conta. */
function neutralOk(): ResetActionResult {
  return {
    ok: true,
    message:
      "Se este e-mail tiver conta, você receberá um link para criar uma nova senha em poucos minutos.",
  };
}

/** 1ª etapa — pedir o link (página /recuperar-senha). */
export async function requestPasswordReset(values: unknown): Promise<ResetActionResult> {
  const parsed = passwordResetRequestSchema.safeParse(values);
  if (!parsed.success) return neutralOk(); // corpo inválido: mesmo comportamento

  const email = parsed.data.email.toLowerCase();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  // Rate limit: 5/min por IP e 3 pedidos por e-mail a cada 15 min.
  if (!rateLimit(`reset:ip:${ip}`, 5, 60_000) || !rateLimit(`reset:email:${email}`, 3, 15 * 60_000)) {
    return neutralOk();
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, isBlocked: true },
    });
    if (user && !user.isBlocked) {
      // Token de 256 bits; o banco guarda apenas o SHA-256 dele.
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + 60 * 60_000); // 1 hora

      await db.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expires },
      });

      const base = storeConfig.siteUrl.replace(/\/$/, "");
      const link = `${base}/recuperar-senha?token=${token}`;
      const mail = layoutMail(
        "Nova senha da D'Griffe",
        `<p>Olá, ${escapeHtml(user.name.split(" ")[0])}!</p>
         <p>Recebemos um pedido para criar uma nova senha para a sua conta.
         Use o botão abaixo — o link <strong>vale apenas 1 hora</strong> e só
         pode ser usado uma vez.</p>
         <p style="margin:24px 0;">
           <a href="${link}" style="background:#1c1917;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;">Criar nova senha</a>
         </p>
         <p style="font-size:13px;color:#78716c;word-break:break-all;">Se o botão não abrir, copie este endereço: ${link}</p>`,
      );
      await sendMail({ to: email, subject: "Crie uma nova senha — D'Griffe", ...mail });
    }
  } catch (err) {
    // Silencioso: o retorno ao usuário não muda nem se o e-mail falhar.
    console.error("[requestPasswordReset]", err);
  }

  return neutralOk();
}

/** 2ª etapa — definir a nova senha (página enviada no e-mail). */
export async function confirmPasswordReset(
  values: unknown,
): Promise<ResetActionResult> {
  const parsed = passwordResetConfirmSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  if (!rateLimit(`reset:confirm:${tokenHash}`, 10, 10 * 60_000)) {
    return { ok: false, error: "Muitas tentativas. Peça um novo link em alguns minutos." };
  }

  try {
    const user = await db.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
      select: { id: true, name: true, email: true, isBlocked: true },
    });
    if (!user || user.isBlocked) {
      return {
        ok: false,
        error: "Este link expirou ou já foi usado. Peça um novo em 'Esqueci minha senha'.",
      };
    }

    const passwordHash = await bcrypt.hash(parsed.data.next, 10);
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // apaga o token: uso único
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    // Aviso de segurança ao titular (coloque em prática o direito à informação).
    const base = storeConfig.siteUrl.replace(/\/$/, "");
    const mail = layoutMail(
      "Sua senha foi trocada",
      `<p>Olá, ${escapeHtml(user.name.split(" ")[0])}!</p>
       <p>A senha da sua conta acabou de ser trocada. Se foi você, tudo certo — nada a fazer!</p>
       <p>Se NÃO foi você, responda este e-mail ou ligue (11) 4002-8922 imediatamente.
       O link antigo perdeu a validade; sua conta segue segura.</p>
       <p><a href="${base}/entrar" style="color:#1c1917;">Entrar em minha conta</a></p>`,
    );
    await sendMail({ to: user.email, subject: "Sua senha foi trocada — D'Griffe", ...mail });

    return { ok: true, message: "Senha trocada! Use a nova para entrar." };
  } catch (err) {
    console.error("[confirmPasswordReset]", err);
    return { ok: false, error: "Não foi possível trocar a senha agora. Tente de novo." };
  }
}
