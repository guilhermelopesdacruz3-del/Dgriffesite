import Link from "next/link";
import { Container } from "@/components/ui/container";
import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/google-button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar",
  description: "Acesse sua conta para acompanhar pedidos, favoritos e receitas.",
};

interface Props {
  searchParams: Promise<{ callbackUrl?: string; erro?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl, erro } = await searchParams;

  // Defesa extra (além do middleware): logado não vê a página de login
  const session = await auth();
  if (session?.user) redirect("/minha-conta");

  return (
    <Container className="max-w-md py-14 md:py-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-card md:p-10">
        <h1 className="font-serif text-3xl leading-tight">Entrar</h1>
        <p className="mt-2 text-sm text-stone-500">
          Ou{" "}
          <Link href="/criar-conta" className="text-accent-700 underline-offset-4 hover:underline">
            crie sua conta
          </Link>{" "}
          — leva menos de um minuto.
        </p>

        {erro === "admin" && (
          <p role="alert" className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Acesso restrito: só administradores entram no painel.
          </p>
        )}

        <div className="mt-8">
          <LoginForm callbackUrl={callbackUrl} />
          <p className="mt-4 text-center text-sm">
            <Link href="/recuperar-senha" className="underline underline-offset-4 hover:text-ink">
              Esqueci minha senha
            </Link>
          </p>
        </div>

        {/* OAuth aparece só quando as credenciais Google estão configuradas */}
        <div className="mt-6">
          {process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />ou<span className="h-px flex-1 bg-stone-200" />
              </div>
              <GoogleButton callbackUrl={callbackUrl} />
            </>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
