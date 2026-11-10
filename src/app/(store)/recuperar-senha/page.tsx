import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Container } from "@/components/ui/container";
import { RecuperarSenhaForm } from "@/components/auth/recuperar-senha-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recuperar senha",
  description: "Esqueceu a senha da sua conta D'Griffe? Receba um link para criar nova senha.",
};

/**
 * Fase 11 — /recuperar-senha: forma autônoma de recuperar a conta
 * (auditoria A17): link por e-mail, uso único, válida 1 hora.
 * Logado não precisa desta página.
 */
export default async function RecuperarSenhaPage() {
  const session = await auth();
  if (session?.user) redirect("/minha-conta");

  return (
    <Container className="max-w-md py-14 md:py-20">
      <Suspense fallback={null}>
        <RecuperarSenhaForm />
      </Suspense>
    </Container>
  );
}
