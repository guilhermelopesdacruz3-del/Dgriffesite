import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/validators/auth";
import { rateLimit } from "@/lib/rate-limit";

/** Erro de login para o cliente mapear por `code` */
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const hasGoogle =
  !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

/**
 * Autenticação completa (servidor Node): adapter Prisma, Google OAuth e
 * credenciais e-mail/senha com bcrypt + rate limit simples em memória.
 * (Produção multi-instância: trocar o limiter por Upstash/Redis.)
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    ...(hasGoogle
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (data, request) => {
        const parsed = loginSchema.safeParse(data);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();

        // Rate limit: 5 tentativas/min por credenciais e 10/min por IP
        const ip = request?.headers?.get("x-forwarded-for") ?? "local";
        const okEmail = rateLimit(`login:email:${email}`, 5, 60_000);
        const okIp = rateLimit(`login:ip:${ip}`, 10, 60_000);
        if (!okEmail || !okIp) throw new RateLimitedError();

        const user = await db.user.findUnique({ where: { email } });
        // Sem hash = conta só-Google; não vazar qual dos dois errou
        if (!user?.passwordHash || user.isBlocked) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  events: {
    // Auditoria leve: registrar último acesso de qualquer provedor
    async signIn({ user }) {
      if (user?.id) {
        await db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => null);
      }
    },
  },
});
