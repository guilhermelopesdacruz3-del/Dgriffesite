import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { AccountNav } from "@/components/account/account-nav";

/**
 * Shell da área logada do cliente (Fase 5): protege as sub-rotinas
 * (middleware já barrada anônimos) e desenha as abas compartilhadas.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/entrar?callbackUrl=/minha-conta");

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Minha conta" }]} />
      <AccountNav />
      <div className="mt-10">{children}</div>
    </Container>
  );
}
