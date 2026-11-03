import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Config "edge-safe" do NextAuth: sem Prisma/bcrypt (nunca importados aqui),
 * usada no middleware para proteger rotas e enriquecer token/sessão.
 * Os providers completos ficam em src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/entrar" },
  providers: [],
  session: { strategy: "jwt" },
  // Next.js/o runtime define o host corretamente; exigido pelo Auth.js
  // fora da Vercel (p.ex. `next start` local) para aceitar a requisição.
  trustHost: true,
  callbacks: {
    // Mantém id e papel do usuário no JWT/sessão (credentials + Google)
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
    // Regras de acesso aplicadas pelo matcher em src/middleware.ts
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;

      // Painel admin: só ADMIN
      if (path === "/admin") {
        if (role !== "ADMIN") {
          return Response.redirect(new URL("/entrar?erro=admin", request.nextUrl));
        }
        return true;
      }
      // Área privada do cliente (inclui sub-rotinas /minha-conta/*)
      if (path === "/minha-conta" || path.startsWith("/minha-conta/")) {
        if (!isLoggedIn) {
          return Response.redirect(
            new URL(`/entrar?callbackUrl=${encodeURIComponent(path)}`, request.nextUrl),
          );
        }
        return true;
      }
      // Já logado tentando acessar login/cadastro → mandar para a conta
      if ((path === "/entrar" || path === "/criar-conta") && isLoggedIn) {
        return Response.redirect(new URL("/minha-conta", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
