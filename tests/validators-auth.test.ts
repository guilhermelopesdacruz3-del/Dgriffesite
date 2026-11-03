import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
} from "@/lib/validators/auth";

/** Schemas de autenticação — regra de senha: mínimo 8, letras E números. */
describe("passwordResetConfirmSchema", () => {
  const base = { token: "a".repeat(64), confirm: "" };

  it("aceita senha forte e tokens de 64 hex", () => {
    const r = passwordResetConfirmSchema.safeParse({
      ...base,
      next: "NovaSenha123",
      confirm: "NovaSenha123",
    });
    expect(r.success).toBe(true);
  });

  it("recusa senha só de letras (A16: letras + números)", () => {
    const r = passwordResetConfirmSchema.safeParse({
      ...base,
      next: "somenteletras",
      confirm: "somenteletras",
    });
    expect(r.success).toBe(false);
  });

  it("recusa senha curta (<8)", () => {
    const r = passwordResetConfirmSchema.safeParse({
      ...base,
      next: "abc123",
      confirm: "abc123",
    });
    expect(r.success).toBe(false);
  });

  it("recusa quando as senhas não conferem", () => {
    const r = passwordResetConfirmSchema.safeParse({
      ...base,
      next: "NovaSenha123",
      confirm: "Diferente123",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join(" | ");
      expect(msgs).toContain("As senhas não conferem");
    }
  });

  it("recusa token curto (link adulterado)", () => {
    const r = passwordResetConfirmSchema.safeParse({
      token: "curto",
      next: "NovaSenha123",
      confirm: "NovaSenha123",
    });
    expect(r.success).toBe(false);
  });
});

describe("passwordResetRequestSchema", () => {
  it("aceita e-mail válido e recusa inválido", () => {
    expect(passwordResetRequestSchema.safeParse({ email: "ana@exemplo.com" }).success).toBe(true);
    expect(passwordResetRequestSchema.safeParse({ email: "nao-e-email" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("exige letras e números e confirmação igual", () => {
    const ok = registerSchema.safeParse({
      name: "Ana Silva",
      email: "ana@exemplo.com",
      password: "Senha1234",
      passwordConfirm: "Senha1234",
    });
    expect(ok.success).toBe(true);

    const trocada = registerSchema.safeParse({
      name: "Ana Silva",
      email: "ana@exemplo.com",
      password: "Senha1234",
      passwordConfirm: "Outra1234",
    });
    expect(trocada.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("aceita o básico e recusa corpo vazio", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
  });
});
