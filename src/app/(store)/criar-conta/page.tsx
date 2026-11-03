import Link from "next/link";
import { Container } from "@/components/ui/container";
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/google-button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar conta",
  description: "Crie sua conta para comprar com cupom de boas-vindas.",
};

interface Props {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;

  const session = await auth();
  if (session?.user) redirect("/minha-conta");

  return (
    <Container className="max-w-lg py-14 md:py-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-card md:p-10">
        <h1 className="font-serif text-3xl leading-tight">Criar conta</h1>
        <p className="mt-2 text-sm text-stone-500">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-accent-700 underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>

        <div className="mt-8">
          <RegisterForm callbackUrl={callbackUrl} />
        </div>

        {process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
              <span className="h-px flex-1 bg-stone-200" />ou<span className="h-px flex-1 bg-stone-200" />
            </div>
            <GoogleButton callbackUrl={callbackUrl} />
          </>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-stone-400">
          Ao criar conta você concorda com os{" "}
          <Link href="/paginas/termos" className="underline">Termos de uso</Link> e a{" "}
          <Link href="/paginas/politica-de-privacidade" className="underline">
            política de privacidade (LGPD)
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
