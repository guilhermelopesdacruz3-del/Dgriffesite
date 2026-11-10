/**
 * Envio de e-mail (Fase 11) — via Resend.
 *
 * Com RESEND_API_KEY configurada: envia de verdade (o domínio de origem é
 * `EMAIL_FROM`, ex.: "D'Griffe <loja@seudominio.com.br>").
 * Sem chave (desenvolvimento/demonstração): NÃO quebra o fluxo — registra o
 * e-mail no console do servidor, o que permite testar reset de senha e
 * confirmação de pedido de ponta a ponta sem nenhum serviço externo.
 *
 * Privacidade: nenhum e-mail é logado no banco; erros são silenciosos
 * (best-effort) para nunca travar uma compra por problema de e-mail.
 */
interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail({ to, subject, html, text }: MailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "D'Griffe <onboarding@resend.dev>";

  if (!key) {
    console.info(
      `[email·fallback] SEM RESEND_API_KEY — e-mail registrado no console em vez de enviado\n` +
        `  → Assunto: ${subject}\n` +
        `  → Texto: ${text.replace(/\s+/g, " ")}`,
    );
    return true;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const result = await resend.emails.send({ from, to, subject, html, text });
    if (result.error) {
      console.error("[email] erro do Resend ao enviar:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] falha ao enviar:", err);
    return false;
  }
}

/** Escapa < > & nos e-mails (nomes/códigos entram como texto). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Motor de template simples (mesma linguagem do loja: sóbrio, pt-BR).
 * Retorna HTML + texto com o layout padrão da loja.
 */
export function layoutMail(title: string, bodyHtml: string): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#faf9f7;font-family:Georgia,serif;color:#1c1917;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:16px;">
      <tr><td style="padding:28px 32px 4px;">
        <p style="margin:0;letter-spacing:.2em;font-size:12px;text-transform:uppercase;color:#78716c;">D'Griffe</p>        <h1 style="margin:8px 0 0;font-size:22px;font-weight:normal;">${escapeHtml(title)}</h1>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c;">
        Se você não pediu isso, ignore este e-mail. Atendimento: contato@dgriffe.com.br
      </td></tr>
    </table>
  </body>
</html>`;

  // Versão em texto puro: removes tags, mantém o essencial
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { html, text };
}
