import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import ProvadorStudio from "@/components/provador/provador-studio";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Estúdio de prova virtual",
  description:
    "Experimente a armação no seu rosto em 3D e em tempo real, direto do navegador. O vídeo é processado 100% no seu aparelho.",
};

interface EstudioProps {
  searchParams: Promise<{ produto?: string; calib?: string }>;
}

export default async function ProvadorEstudioPage({ searchParams }: EstudioProps) {
  const { produto, calib } = await searchParams;
  let productName = "Armação de demonstração";
  let glbUrl: string | null = null;
  let productSlug: string | null = null;
  let calibInit: {
    scale: number;
    x: number;
    y: number;
    z: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    turn?: boolean;
    stretchX?: number;
    stretchY?: number;
    tilt?: number;
  } | null = null;
  /** Modo calibração (?calib=1): só ADMIN vê o botão de salvar. */
  let calibSave: { modelId: string } | null = null;

  // Aceita ?produto=slug — carrega o modelo 3D ativo do produto (Model3D.glbUrl)
  // e a calibração salva no admin. Sem slug/banco, o estúdio abre com a armação
  // de demonstração.
  const slug = produto && /^[a-z0-9-]{1,120}$/.test(produto) ? produto : null;
  if (slug) {
    try {
      const row = await db.product.findUnique({
        where: { slug },
        select: {
          name: true,
          active: true,
          deletedAt: true,
          model3d: {
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (row && row.active && row.deletedAt === null) {
        productSlug = slug;
        productName = row.name;
        const m = row.model3d[0];
        if (m) {
          glbUrl = m.glbUrl;
          calibInit = {
            scale: m.scale,
            x: m.offsetX,
            y: m.offsetY,
            z: m.offsetZ,
            rotX: m.rotX,
            rotY: m.rotY,
            rotZ: m.rotZ,
            turn: m.turn,
            stretchX: m.stretchX,
            stretchY: m.stretchY,
            tilt: m.tilt,
          };
          // ?calib=1 + admin logado: libera o botão "Salvar calibração".
          if (calib === "1") {
            const session = await auth();
            if (session && session.user?.role === "ADMIN") {
              calibSave = { modelId: m.id };
            }
          }
        }
      }
    } catch {
      // Banco indisponível (ex.: Docker desligado): estúdio continua com demo.
    }
  }

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          { label: "Provador virtual", href: "/provador" },
          { label: "Estúdio" },
        ]}
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-serif text-3xl leading-tight md:text-4xl">Estúdio de prova virtual</h1>
          <p className="mt-2 text-stone-600">
            Posicione o rosto em frente à câmera. A armação acompanha a cabeça com escala real,
            oclusão e sombra — e a luz do palco imita a iluminação do seu ambiente.
          </p>
        </div>
        <p className="rounded-full bg-accent-50 px-4 py-2 text-xs font-medium text-accent-700">
          🔒 Processamento 100% local — nada é enviado aos servidores
        </p>
      </div>

      <div className="mt-6">
        <ProvadorStudio
          productName={productName}
          glbUrl={glbUrl}
          calibInit={calibInit}
          productSlug={productSlug}
          calibSave={calibSave}
        />
      </div>

      <dl className="mt-8 grid gap-4 text-sm text-stone-600 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 p-4">
          <dt className="font-medium text-stone-800">Distância ideal</dt>
          <dd className="mt-1">Fique a 40–70 cm da câmera, com o rosto centrado no quadro.</dd>
        </div>
        <div className="rounded-2xl border border-stone-200 p-4">
          <dt className="font-medium text-stone-800">Luz</dt>
          <dd className="mt-1">Luz frontal suave (janela ou luminária) dá o melhor encaixe e sombra.</dd>
        </div>
        <div className="rounded-2xl border border-stone-200 p-4">
          <dt className="font-medium text-stone-800">Encaixe fino</dt>
          <dd className="mt-1">
            Use os ajustes abaixo do palco (escala, inclinação, X/Y/Z) para calibrar como uma
            ótica faria na bancada.
          </dd>
        </div>
      </dl>
    </Container>
  );
}
