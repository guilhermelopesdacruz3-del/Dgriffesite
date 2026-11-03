import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getAnnouncement } from "@/lib/content";
import { auth } from "@/auth";

// No build estático (ZIP de demo), scripts/build-demo-zip.mjs troca esta
// linha para "force-static" (pré-renderiza tudo com fallbacks embutidos).
export const dynamic = "force-dynamic";

// Shell da loja (barra de anúncio + header + conteúdo + footer).
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [announcement, session] = await Promise.all([
    getAnnouncement(),
    auth(),
  ]);

  return (
    <div className="flex min-h-svh flex-col">
      <AnnouncementBar message={announcement} />
      <Header
        user={
          session?.user
            ? {
                name: session.user.name ?? "",
                email: session.user.email ?? "",
                role: session.user.role,
              }
            : null
        }
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
