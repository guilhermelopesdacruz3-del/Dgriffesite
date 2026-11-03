import { ScanFace, Camera, ShoppingBag, Lock, ImagePlus } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Provador virtual",
  description:
    "Experimente óculos pelo navegador com IA que roda no seu aparelho — nada é enviado ou gravado nos nossos servidores.",
};

// Página explicativa do provador. O estúdio interativo (câmera + MediaPipe +
// Three.js) fica em /provador/estudio — Fase 8.
const steps = [
  {
    icon: ScanFace,
    title: "Permita a câmera",
    desc: "O navegador pedirá permissão. Explicamos exatamente o que aparece na tela e nada é gravado ou enviado para servidores.",
  },
  {
    icon: Camera,
    title: "Encaixe os óculos",
    desc: "Posicione seu rosto dentro do guia. O modelo 3D acompanha a cabeça em tempo real, com sombra e escala realistas.",
  },
  {
    icon: ShoppingBag,
    title: "Fotografe e compre",
    desc: "Tire uma foto para comparar com amigos, troque de cor e adicione ao carrinho dentro do próprio provador.",
  },
];

export default function TryOnIntroPage() {
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Provador virtual" }]} />

      <div className="mt-6 max-w-3xl">
        <h1 className="font-serif text-4xl leading-tight md:text-5xl">
          Provador virtual: experimente antes de comprar
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          Nossa IA de visão computacional mapeia 468 pontos do seu rosto direto no
          navegador — o vídeo nunca sai do seu dispositivo e NADA é enviado aos
          nossos servidores. É tecnologia de rastreamento facial local, como um
          filtro de câmera com precisão de instrumento óptico.
        </p>
      </div>

      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="rounded-2xl border border-stone-200 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-700">
              <s.icon size={20} strokeWidth={1.7} aria-hidden />
            </div>
            <h2 className="mt-4 font-serif text-xl">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{s.desc}</p>
          </li>
        ))}
      </ol>

      {/* Plano B: sem câmera */}
      <div className="mt-10 rounded-2xl border border-stone-200 bg-stone-50 p-6 md:flex md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <ImagePlus className="mt-1 shrink-0 text-stone-500" size={22} aria-hidden />
          <div>
            <h2 className="font-medium">Sem câmera? Sem problema.</h2>
            <p className="mt-1 text-sm text-stone-600">
              Envie uma foto frontal do rosto e posicione os óculos manualmente.
              A imagem fica só no seu aparelho.
            </p>
          </div>
        </div>
      </div>

      {/* Privacidade destacada */}
      <div className="mt-6 flex items-start gap-4 rounded-2xl bg-accent-50 p-6">
        <Lock className="mt-1 shrink-0 text-accent-700" size={20} aria-hidden />
        <p className="text-sm text-stone-700">
          <strong className="font-semibold">Privacidade em primeiro lugar:</strong>{" "}
          o processamento de vídeo acontece 100% no seu aparelho (WebGL/mediapipe).
          Não gravamos vídeo, áudio ou imagem sem seu pedido explícito — e fotos
          salvas podem ser apagadas quando quiser em Minha conta → Fotos do provador.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button href="/provador/estudio" size="lg">
          Abrir o estúdio de prova
        </Button>
        <Button href="/produtos" variant="outline" size="lg">
          Ver produtos com provador
        </Button>
        <Button href="/paginas/provador" variant="outline" size="lg">
          Perguntas frequentes do provador
        </Button>
      </div>

      <p className="mt-6 text-xs text-stone-400">
        Requisitos: navegador atualizado (Chrome, Edge, Safari ou Firefox) com
        suporte a WebGL. Recomendamos luz frontal suave para o melhor encaixe.
      </p>
    </Container>
  );
}
