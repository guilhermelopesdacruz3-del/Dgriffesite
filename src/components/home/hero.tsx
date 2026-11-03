import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getHeroBanner } from "@/lib/content";

/** Hero em tela cheia (banner editável no admin → slot "home_hero"). */
export async function Hero() {
  const hero = await getHeroBanner();

  return (
    <section className="relative">
      <div className="relative h-[82svh] max-h-[860px] min-h-[540px] overflow-hidden">
        {hero.imageUrl && (
          <Image
            src={hero.imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        )}
        {/* Escurecimento para legibilidade do texto (esquerda) */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" aria-hidden />

        <Container className="relative flex h-full items-center">
          <div className="max-w-xl text-white">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Nova coleção • {new Date().getFullYear()}
            </p>
            <h1 className="font-serif text-4xl leading-[1.08] md:text-6xl">
              {hero.title}
            </h1>
            {hero.subtitle && (
              <p className="mt-5 text-base leading-relaxed text-white/85 md:text-lg">
                {hero.subtitle}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              {hero.ctaLabel && (
                <Button href={hero.ctaHref ?? "/produtos"} size="lg">
                  {hero.ctaLabel}
                </Button>
              )}
              {hero.ctaLabel2 && (
                <Link
                  href={hero.ctaHref2 ?? "/provador"}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-white/70 px-8 text-base font-medium text-white transition-colors hover:bg-white hover:text-ink"
                >
                  {hero.ctaLabel2}
                </Link>
              )}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
