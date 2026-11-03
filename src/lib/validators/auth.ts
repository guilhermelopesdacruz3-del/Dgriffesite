import { z } from "zod";

/** Auditoria (A16): a senha precisa combinar letras e números. */
const temLetraENumero = (v: string) => /[a-zA-Z]/.test(v) && /\d/.test(v);

// Login (usado também no authorize do NextAuth)
export const loginSchema = z.object({
  email: z.string().trim().min(3, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha").max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------
// Reset de senha (Fase 11)

/** 1ª etapa: pedir o link. */
export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(120),
});

/** 2ª etapa: definir a nova senha pelo link do e-mail. */
export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(32, "Link inválido").max(64),
    next: z
      .string()
      .min(8, "Nova senha: mínimo de 8 caracteres")
      .max(72)
      .refine(temLetraENumero, "Nova senha: precisa ter letras e números"),
    confirm: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.next !== data.confirm) {
      ctx.addIssue({
        code: "custom",
        message: "As senhas não conferem",
        path: ["confirm"],
      });
    }
  });

// Cadastro
export const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome").max(80),
    email: z.string().trim().email("E-mail inválido").max(120),
    password: z
      .string()
      .min(8, "Mínimo de 8 caracteres")
      .max(72)
      .refine(temLetraENumero, "Precisa ter letras e números"),
    passwordConfirm: z.string(),
    marketingOptIn: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "As senhas não conferem",
        path: ["passwordConfirm"],
      });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;
