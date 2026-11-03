import { z } from "zod";

// ------------------------- Fase 5: conta do cliente -------------------------

/** Só dígitos, sem máscara (o input é formatado no cliente). */
const onlyDigits = (v: string) => v.replace(/\D/g, "");

// Perfil: nome, telefone, CPF
/**
 * Dígitos verificadores do CPF (auditoria A18): a validação anterior aceitava
 * "111.111.111-11" ou qualquer sequência de 11 números.
 */
export function isCpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os dígitos iguais
  const p1 = [...cpf.slice(0, 9)].reduce((s, d, i) => s + Number(d) * (10 - i), 0);
  const dv1 = (p1 * 10) % 11 % 10;
  const p2 = [...cpf.slice(0, 10)].reduce((s, d, i) => s + Number(d) * (11 - i), 0);
  const dv2 = (p2 * 10) % 11 % 10;
  return Number(cpf[9]) === dv1 && Number(cpf[10]) === dv2;
}

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? onlyDigits(v) : ""))
    .refine((v) => v === "" || v.length === 10 || v.length === 11, {
      message: "Telefone com DDD (10 ou 11 números)",
    }),
  document: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? onlyDigits(v) : ""))
    .refine((v) => v === "" || v.length === 11, {
      message: "CPF deve ter 11 números",
    })
    .refine((v) => v === "" || isCpfValido(v), {
      message: "CPF inválido (confira os números)",
    }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// Trocar senha (conta Google pode criar a primeira senha sem informar a atual)
// Auditoria (A16): mesma regra do cadastro — letras e números.
const temLetraENumero = (v: string) => /[a-zA-Z]/.test(v) && /\d/.test(v);

export const changePasswordSchema = z
  .object({
    current: z.string().trim().optional().default(""),
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
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Endereço de entrega
export const addressSchema = z.object({
  cep: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((v) => v.length === 8, { message: "CEP deve ter 8 números" }),
  street: z.string().trim().min(3, "Informe a rua").max(120),
  number: z.string().trim().min(1, "Informe o número").max(20),
  complement: z.string().trim().max(60).optional().default("").transform((v) => v || undefined),
  district: z.string().trim().min(2, "Informe o bairro").max(80),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[A-Z]{2}$/.test(v), { message: "UF com 2 letras (ex.: SP)" }),
  isDefault: z.boolean().optional().default(false),
  receiverName: z.string().trim().max(80).optional().default("").transform((v) => v || undefined),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .default("")
    .transform((v) => (v ? onlyDigits(v) : undefined))
    .refine((v) => !v || v.length === 10 || v.length === 11, {
      message: "Telefone com DDD (10 ou 11 números)",
    }),
});
export type AddressInput = z.infer<typeof addressSchema>;
