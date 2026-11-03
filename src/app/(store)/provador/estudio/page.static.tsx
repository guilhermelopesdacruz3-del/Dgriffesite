"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import ProvadorStudio from "@/components/provador/provador-studio";

/**
 * Variante ESTÁTICA de /provador/estudio — usada apenas no build do ZIP de
 * demo (`STATIC_EXPORT=1`); o `scripts/build-demo-zip.mjs` troca o conteúdo de
 * `page.tsx` durante o build e restaura o original no fim. Lê `?produto=` no
 * cliente (sem servidor para consultar o banco) e sempre exibe a armação
 * padrão da loja em `public/models/frame-padrao.glb`.
 */

function EstudioBoot() {
  const params = useSearchParams();
  const raw = params.get("produto") ?? "";
  const slug = /^[a-z0-9-]{1,120}$/.test(raw) ? raw : null;

  return (
    <ProvadorStudio
      productName={slug ? "Armação em exibição" : "Armação padrão"}
      glbUrl={null}
      productSlug={slug}
    />
  );
}

export default function EstudioStaticPage() {
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

      {/* useSearchParams precisa de fronteira Suspense no modo estático. */}
      <div className="mt-6">
        <Suspense
          fallback={
            <div className="h-[520px] animate-pulse rounded-3xl border border-stone-200 bg-stone-100" />
          }
        >
          <EstudioBoot />
        </Suspense>
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
