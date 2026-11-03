import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Proxy de borda (Next 16 — antes "middleware") que aplica as regras de
 * `authorized` do authConfig: /admin → só ADMIN; /minha-conta → logado;
 * /entrar → redireciona logados.
 */
const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  matcher: ["/admin", "/admin/:path*", "/minha-conta/:path*", "/entrar", "/criar-conta"],
};
