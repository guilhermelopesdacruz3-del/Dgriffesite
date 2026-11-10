/**
 * ============================================================
 * SEED do banco — dados de exemplo completos
 * ============================================================
 * • 1 admin + 1 cliente (senhas em bcrypt)
 * • 8 marcas fictícias, 5 categorias
 * • 20 produtos com variações de cor, estoque e imagens (fotos de armações reais)
 * • Pacotes de lente, cupom de primeira compra, banners, páginas e settings
 *
 * Rodar:  npm run db:seed
 * ⚠️ Limpa as tabelas antes de popular — use apenas em desenvolvimento.
 */

// Carrega o .env antes de conectar (o seed roda fora do Next)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { ProductType, Gender, FrameShape } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PRODUCT_IMAGES, CATEGORY_IMAGES, HERO_IMAGE } from "./eyewear-images";

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@dgriffe.test").toLowerCase();
const CUSTOMER_EMAIL = "cliente@dgriffe.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234";

type SeedVariant = { color: string; hex: string; stock: number; size?: string };
type SeedProduct = {
  name: string;
  brand: string;
  category: string;
  type: ProductType;
  gender: Gender;
  shape?: FrameShape;
  material?: string;
  lens?: number;
  bridge?: number;
  temple?: number;
  weight?: number;
  price: number;
  comparePrice?: number;
  description: string;
  variants: SeedVariant[];
  featured?: boolean;
  isNew?: boolean;
};

// ----------------------------- Dados base -----------------------------
const BRANDS = [
  { name: "Atelier Óptico", description: "Armações artesanais em acetato italiano." },
  { name: "Verano", description: "Sol e praia com proteção UV400." },
  { name: "Lumen", description: "Design minimalista para o dia a dia." },
  { name: "Órbita", description: "Formas experimentais e cores vivas." },
  { name: "Nordica", description: "Esportivos resistentes ao vento e impacto." },
  { name: "Cristalina", description: "Lentes de contato premium." },
  { name: "Maré", description: "Armações infantis leves e flexíveis." },
  { name: "Andino", description: "Montanha e trilha com lentes polarizadas." },
  { name: "D'Griffe Joias", description: "Joias em ouro feitas com artesanato próprio." },
];

const CATEGORIES = [
  { name: "Óculos de grau", slug: "oculos-de-grau", img: CATEGORY_IMAGES["oculos-de-grau"] },
  { name: "Óculos de sol", slug: "oculos-de-sol", img: CATEGORY_IMAGES["oculos-de-sol"] },
  { name: "Óculos infantis", slug: "oculos-infantis", img: CATEGORY_IMAGES["oculos-infantis"] },
  { name: "Óculos esportivos", slug: "oculos-esportivos", img: CATEGORY_IMAGES["oculos-esportivos"] },
  { name: "Lentes de contato", slug: "lentes-de-contato", img: CATEGORY_IMAGES["lentes-de-contato"] },
  { name: "Joias", slug: "joias", img: CATEGORY_IMAGES["joias"] },
];

const COLORS = {
  preto: { color: "Preto fosco", hex: "#17171a" },
  havana: { color: "Tortoise", hex: "#7a4a2b" },
  dourado: { color: "Dourado", hex: "#b98d4f" },
  prata: { color: "Prata", hex: "#b7b9bd" },
  grafite: { color: "Grafite", hex: "#4a4a52" },
  vinho: { color: "Vinho", hex: "#5c2e35" },
  marfim: { color: "Marfim", hex: "#e8e2d9" },
  verde: { color: "Verde militar", hex: "#3c4f3f" },
  azul: { color: "Azul petróleo", hex: "#2b4a68" },
  cristal: { color: "Cristal", hex: "#e0d6c4" },
  rosa: { color: "Rosa", hex: "#d9909c" },
  laranja: { color: "Laranja intense", hex: "#e07b39" },
};

// 20 produtos fictícios de exemplo
const PRODUCTS: SeedProduct[] = [
  // --- Óculos de grau (8) ---
  { name: "Aura Redonda", brand: "Lumen", category: "Óculos de grau", type: "FRAMES", gender: "UNISEX", shape: "ROUND", material: "Acetato italiano", lens: 48, bridge: 22, temple: 145, weight: 24, price: 449.9, comparePrice: 649.9, description: "Redonda clássica em acetato polido, leve e confortável para o dia inteiro.",
    variants: [ { ...COLORS.preto, stock: 12 }, { ...COLORS.havana, stock: 8 } ], featured: true },
  { name: "Milano Quadrado", brand: "Atelier Óptico", category: "Óculos de grau", type: "FRAMES", gender: "MASCULINE", shape: "SQUARE", material: "Acetato italiano", lens: 52, bridge: 18, temple: 150, weight: 28, price: 589.9, description: "Armação de acetato italiano com charneira reforçada; cai bem em rostos largos.",
    variants: [ { ...COLORS.havana, stock: 10 }, { ...COLORS.preto, stock: 14 } ], featured: true },
  { name: "Pali Retangular", brand: "Lumen", category: "Óculos de grau", type: "FRAMES", gender: "MASCULINE", shape: "RECTANGULAR", material: "Metal", lens: 54, bridge: 17, temple: 140, weight: 22, price: 699.9, comparePrice: 799.9, description: "Retangular em metal com hastes flexíveis; sofisticada para trabalho e lazer.",
    variants: [ { ...COLORS.dourado, stock: 6 }, { ...COLORS.prata, stock: 5 } ], featured: true },
  { name: "Duna Oval", brand: "Lumen", category: "Óculos de grau", type: "FRAMES", gender: "FEMININE", shape: "OVAL", material: "TR90", lens: 50, bridge: 19, temple: 140, weight: 16, price: 329.9, description: "Leve e resistente: TR90 superflexível com plaquetas ajustáveis e toque macio.",
    variants: [ { ...COLORS.cristal, stock: 18 }, { ...COLORS.preto, stock: 9 } ], featured: true },
  { name: "Íris Gatinho", brand: "Órbita", category: "Óculos de grau", type: "FRAMES", gender: "FEMININE", shape: "CAT_EYE", material: "Acetato", lens: 51, bridge: 16, temple: 140, weight: 25, price: 389.9, comparePrice: 449.9, description: "Gatinho acetinado com detalhe metálico frontal; realça o olhar.",
    variants: [ { ...COLORS.vinho, stock: 11 }, { ...COLORS.preto, stock: 7 } ], featured: true },
  { name: "Vento Redonda", brand: "Lumen", category: "Óculos de grau", type: "FRAMES", gender: "UNISEX", shape: "ROUND", material: "Metal", lens: 46, bridge: 21, temple: 145, weight: 19, price: 479.9, description: "Redonda minimalista em aço leve; ponte dupla fina para efeito vintage.",
    variants: [ { ...COLORS.grafite, stock: 13 }, { ...COLORS.dourado, stock: 4 } ], featured: true },
  { name: "Rosa Duas Pontes", brand: "Lumen", category: "Óculos de grau", type: "FRAMES", gender: "FEMININE", shape: "OVAL", material: "Acetato", lens: 49, bridge: 20, temple: 142, weight: 22, price: 439.9, description: "Ponte dupla acetinada com toque feminino e detalhe discreto nas hastes.",
    variants: [ { ...COLORS.rosa, stock: 10 }, { ...COLORS.marfim, stock: 6 } ] },
  { name: "Aurora Oval", brand: "Atelier Óptico", category: "Óculos de grau", type: "FRAMES", gender: "FEMININE", shape: "OVAL", material: "Acetato italiano", lens: 51, bridge: 19, temple: 142, weight: 24, price: 629.9, description: "Oval elegante em acetato acetinado com plaquetas em acetil; acabamento premium.",
    variants: [ { ...COLORS.vinho, stock: 9 }, { ...COLORS.preto, stock: 11 } ] },

  // --- Óculos de sol (7) ---
  { name: "Caraíva Aviador", brand: "Verano", category: "Óculos de sol", type: "SUNGLASSES", gender: "UNISEX", shape: "AVIATOR", material: "Metal", lens: 58, bridge: 14, temple: 140, weight: 27, price: 459.9, comparePrice: 599.9, description: "Aviador clássico com lente polarizada UV400 e serigrafia discreta nas hastes.",
    variants: [ { ...COLORS.dourado, stock: 15 }, { ...COLORS.prata, stock: 9 } ], featured: true },
  { name: "Búzios Quadrado", brand: "Verano", category: "Óculos de sol", type: "SUNGLASSES", gender: "UNISEX", shape: "SQUARE", material: "Acetato", lens: 55, bridge: 18, temple: 145, weight: 26, price: 429.9, description: "Quadrado bold com lente G15 verde — visão natural e contraste equilibrado.",
    variants: [ { ...COLORS.preto, stock: 16 }, { ...COLORS.havana, stock: 5 } ], featured: true },
  { name: "Farol Gatinho", brand: "Órbita", category: "Óculos de sol", type: "SUNGLASSES", gender: "FEMININE", shape: "CAT_EYE", material: "Acetato", lens: 52, bridge: 17, temple: 140, weight: 24, price: 379.9, description: "Gatinho marfim com lente marrom gradiente; proteção em dia de sol intenso.",
    variants: [ { ...COLORS.marfim, stock: 12 }, { ...COLORS.preto, stock: 8 } ], featured: true },
  { name: "Jeri Redondo", brand: "Verano", category: "Óculos de sol", type: "SUNGLASSES", gender: "UNISEX", shape: "ROUND", material: "Acetato", lens: 50, bridge: 21, temple: 145, weight: 23, price: 349.9, description: "Redondinho tortoise com lente verde; vibe retrô litorânea.",
    variants: [ { ...COLORS.havana, stock: 14 }, { ...COLORS.azul, stock: 6 } ], featured: true },
  { name: "Faro Espelhado", brand: "Órbita", category: "Óculos de sol", type: "SUNGLASSES", gender: "UNISEX", shape: "AVIATOR", material: "Metal", lens: 60, bridge: 13, temple: 138, weight: 25, price: 489.9, description: "Aviador de metal superleve com lente espelhada; brilha sem exagero.",
    variants: [ { ...COLORS.prata, stock: 8 } ], isNew: true },
  { name: "Solum Wrap", brand: "Verano", category: "Óculos de sol", type: "SUNGLASSES", gender: "UNISEX", shape: "WRAP", material: "TR90", lens: 62, bridge: 15, temple: 135, weight: 21, price: 419.9, comparePrice: 469.9, description: "Wrap para corrida e ciclismo, com lente antirrisco e apoio antitranspirante.",
    variants: [ { ...COLORS.preto, stock: 10 }, { ...COLORS.laranja, stock: 7 } ], isNew: true },
  { name: "Marés Quadrado", brand: "Verano", category: "Óculos de sol", type: "SUNGLASSES", gender: "FEMININE", shape: "SQUARE", material: "Acetato", lens: 54, bridge: 18, temple: 142, weight: 26, price: 419.9, description: "Quadrado oversized com lente gradiente; leve e elegante para o dia a dia.",
    variants: [ { ...COLORS.preto, stock: 11 } ] },

  // --- Infantis (3) ---
  { name: "Pipa Grau Flex", brand: "Maré", category: "Óculos infantis", type: "FRAMES", gender: "KIDS", shape: "SQUARE", material: "TR90", lens: 46, bridge: 15, temple: 125, weight: 14, price: 259.9, description: "Flexível e à prova de bagunça, com plaquetas ajustáveis e cores para escolher.",
    variants: [ { ...COLORS.azul, stock: 9 }, { ...COLORS.rosa, stock: 9 } ], isNew: true },
  { name: "Bolha Grau", brand: "Maré", category: "Óculos infantis", type: "FRAMES", gender: "KIDS", shape: "ROUND", material: "TR90", lens: 44, bridge: 16, temple: 122, weight: 13, price: 249.9, description: "Redondinha leve à prova de quedas, com lentes antirrisco de série.",
    variants: [ { ...COLORS.marfim, stock: 7 }, { ...COLORS.verde, stock: 8 } ] },
  { name: "Fada Sol", brand: "Maré", category: "Óculos infantis", type: "SUNGLASSES", gender: "KIDS", shape: "CAT_EYE", material: "TR90", lens: 47, bridge: 14, temple: 120, weight: 15, price: 269.9, comparePrice: 299.9, description: "UV400 infantil com lente categoria 3 leve — sol seguro na escola e na praia.",
    variants: [ { ...COLORS.rosa, stock: 12 } ] },

  // --- Esportivos (2) ---
  { name: "Peak Polarizado", brand: "Nordica", category: "Óculos esportivos", type: "SUNGLASSES", gender: "UNISEX", shape: "WRAP", material: "TR90", lens: 64, bridge: 14, temple: 130, weight: 24, price: 699.9, description: "Lentes polarizadas categoria 3 com ventilação lateral; ideal para trilha e praia.",
    variants: [ { ...COLORS.preto, stock: 9 }, { ...COLORS.verde, stock: 4 } ], featured: true },
  { name: "Cordillera Trail", brand: "Andino", category: "Óculos esportivos", type: "SUNGLASSES", gender: "MASCULINE", shape: "WRAP", material: "TR90", lens: 66, bridge: 13, temple: 132, weight: 26, price: 649.9, description: "Envelopado com lente espelhada categoria 4 para alta luminosidade; peso pluma.",
    variants: [ { ...COLORS.grafite, stock: 6 } ], isNew: true },

  // --- Lentes de contato (2) ---
  { name: "Diárias Premium (30 lentes)", brand: "Cristalina", category: "Lentes de contato", type: "CONTACT_LENSES", gender: "UNISEX", price: 119.9, description: "Caixa com 30 lentes diárias de hidrogel silicone; descarte diário, máxima higiene.",
    variants: [
      { color: "Grau -0.50", hex: "#7bb3d0", stock: 40, size: "-0.50" }, { color: "Grau -1.00", hex: "#7bb3d0", stock: 35, size: "-1.00" },
      { color: "Grau -1.50", hex: "#7bb3d0", stock: 28, size: "-1.50" }, { color: "Grau -2.00", hex: "#7bb3d0", stock: 30, size: "-2.00" },
      { color: "Grau -2.50", hex: "#7bb3d0", stock: 22, size: "-2.50" }, { color: "Grau -3.00", hex: "#7bb3d0", stock: 25, size: "-3.00" },
    ], featured: true },
  { name: "Mensais Comfort (2 lentes)", brand: "Cristalina", category: "Lentes de contato", type: "CONTACT_LENSES", gender: "UNISEX", price: 89.9, description: "Par mensal de hidrogel com conforto para longas jornadas de tela.",
    variants: [
      { color: "Grau -1.00", hex: "#7bb3d0", stock: 20, size: "-1.00" }, { color: "Grau -2.00", hex: "#7bb3d0", stock: 18, size: "-2.00" },
      { color: "Grau -4.00", hex: "#7bb3d0", stock: 15, size: "-4.00" },
    ] },

  // --- Joias em ouro (3) — preço por peso: gramas × cotação do ouro × 2,7 (420/g) ---
  { name: "Aliança D'Griffe", brand: "D'Griffe Joias", category: "Joias", type: "JEWEL", gender: "UNISEX", material: "Ouro 18k", weight: 10, price: 11340, description: "Aliança em ouro 18k de 10 g. Preço calculado por peso: gramas × cotação do dia × 2,7.",
    variants: [ { color: "Ouro 18k", hex: "#b8860b", stock: 5 } ] },
  { name: "Anel Aparador D'Griffe", brand: "D'Griffe Joias", category: "Joias", type: "JEWEL", gender: "FEMININE", material: "Ouro 18k", weight: 6, price: 6804, description: "Aparador em ouro 18k de 6 g, polimento brilhante. Preço por peso: gramas × cotação do dia × 2,7.",
    variants: [ { color: "Ouro 18k", hex: "#b8860b", stock: 6 } ], isNew: true },
  { name: "Colar Corrente D'Griffe", brand: "D'Griffe Joias", category: "Joias", type: "JEWEL", gender: "UNISEX", material: "Ouro 18k", weight: 18, price: 20412, description: "Corrente em ouro 18k de 18 g, fecho mosquetão. Preço por peso: gramas × cotação do dia × 2,7.",
    variants: [ { color: "Ouro 18k", hex: "#b8860b", stock: 3 } ], featured: true },
];

const LENS_PACKAGES = [
  { name: "Lentes básicas (CR-39)", description: "Visão simples com proteção UV e camada antirrisco.", price: 189.9, sortOrder: 1 },
  { name: "Lentes antirreflexo + azul", description: "Reduz fadiga em telas; antirreflexo premium nas duas faces.", price: 349.9, sortOrder: 2 },
  { name: "Lentes progressivas premium", description: "Multifocais com adaptação rápida e amplo campo de visão.", price: 899.9, sortOrder: 3 },
];

const BANNER_HERO = {
  slot: "home_hero",
  title: "Enxergue melhor, vista melhor.",
  subtitle:
    "Armações selecionadas com atendimento óptico de verdade — agora com provador virtual 3D.",
  imageUrl: HERO_IMAGE,
  ctaLabel: "Ver coleção",
  ctaHref: "/produtos",
  ctaLabel2: "Experimentar no provador",
  ctaHref2: "/provador",
  sortOrder: 0,
};

// Páginas institucionais em markdown (editáveis pelo admin)
const PAGES: { slug: string; title: string; content: string }[] = [
  {
    slug: "sobre",
    title: "Sobre nós",
    content: `Somos uma ótica comprometida em fazer as pessoas enxergarem — e serem vistas — melhor.

## Nossa história
Começamos em 2015 com uma loja pequena e uma ideia simples: atender com cuidado profissional e preços justos. Hoje somos duas lojas em São Paulo e um e-commerce completo com provador virtual.

## O que acreditamos
- Exame de vista é exame de saúde, não só de grau.
- Cada rosto é único: ajudar a escolher a armação certa faz parte do serviço.
- Preço justo e honesto, sem descontos fantasiosos.

## Nossos diferenciais
- Provador virtual 3D com IA rodando no seu navegador.
- Lentes de fabricantes reconhecidos, com garantia de adaptação.
- Assistência de limpeza e ajustes nas lojas físicas, sempre.`,
  },
  {
    slug: "lojas",
    title: "Lojas físicas",
    content: `Visite uma das nossas lojas para exame de vista, ajustes de armações e atendimento presencial. Agende pelo WhatsApp para evitar filas.

## Como chegar
Cada unidade tem estacionamento conveniado e acesso acessível.

## Exame de vista
Disponível de segunda a sábado. Traga sua receita anterior, se tiver, e os óculos que você já usa.`,
  },
  {
    slug: "contato",
    title: "Contato",
    content: `Prefere resolver por telefone ou WhatsApp? Temos equipe de verdade pronta para ajudar na compra, troca ou agendamento.

## Horários
Atendimento digital: seg a sáb, das 9h às 19h.

## Formulário de contato
Nas próximas fases, este espaço ganha um formulário funcional com resposta por e-mail. Hoje, fale com a gente direto pelo WhatsApp ou e-mail — respondemos em até 1 dia útil.`,
  },
  {
    slug: "faq",
    title: "Perguntas frequentes",
    content: `Reunimos as dúvidas mais comuns sobre compra, envio e provador virtual.

## Compra
- Posso comprar só a armação? Sim — nos modelos de grau você escolhe entre "Só a armação" e "Com lentes" na página do produto.
- Como envio minha receita? Primeiro finalize o pedido; em Minha conta você envia a receita e nosso time óptico valida.

## Envio e prazos
- Prazo médio: 2 a 8 dias úteis, conforme o serviço escolhido no checkout.
- Acompanhamento: código de rastreio por e-mail e em Meus pedidos.

## Trocas
- Janela de 30 dias corridos, com o produto sem sinais de uso.
- Lentes com grau têm garantia de adaptação de 45 dias.

## Provador virtual
- Vocês salvam minhas fotos? Somente com sua autorização — e você pode apagar quando quiser em Minha conta.
- Funciona no meu navegador? Basta um app atualizado com suporte a câmera e WebGL.`,
  },
  {
    slug: "politica-de-trocas",
    title: "Política de trocas",
    content: `Você pode trocar qualquer produto em até 30 dias corridos após o recebimento, sem burocracia, desde que sem sinais de uso e com a nota fiscal.

## Como solicitar
- Pelo WhatsApp, informando o número do pedido e o motivo da troca.
- Coleta em casa pelo mesmo serviço da entrega (gratuita em caso de defeito).

## Lentes com grau
- Lentes são produzidas sob medida: diante de dificuldade de adaptação, você tem até 45 dias para trocar as lentes sem custo.
- Armações com defeito de fabricação têm 12 meses de garantia.`,
  },
  {
    slug: "politica-de-privacidade",
    title: "Política de privacidade (LGPD)",
    content: `Tratamos seus dados conforme a LGPD (Lei 13.709/2018). Esta página explica o que coletamos, para que servem e como exercer seus direitos.

## Quais dados coletamos
- Conta: nome, e-mail, telefone (e CPF quando exigido para nota fiscal).
- Pedidos: endereços, histórico de compras e receitas que você envia.
- Provador virtual: NADA — o vídeo é processado só no seu aparelho; fotos ficam salvas apenas com seu consentimento explícito, e você pode apagá-las a qualquer momento.

## Como usamos os dados
- Processar pedidos, pagamentos, entregas e trocas.
- Enviar comunicações apenas quando você autorizar (cancelamento a qualquer momento).

## Como exercer seus direitos
- Exportar dados e apagar conta: em Minha conta → Configurações.
- Dúvidas de privacidade: privacidade@dgriffe.com.br

## Compartilhamento
Dados são compartilhados apenas com parceiros essenciais à operação: plataforma de pagamento (Mercado Pago), transportadora e serviço de e-mail.`,
  },
  {
    slug: "termos",
    title: "Termos de uso",
    content: `Ao utilizar a loja você concorda com estes termos, resumidos de forma clara.

## Compras
- Preços e estoque são validados no servidor na confirmação do pedido.
- Reserva de estoque durante o pagamento: 20 minutos. Após isto, os itens são liberados.

## Provador virtual
- O provador é uma ferramenta de visualização; as medidas exatas de cada modelo estão na página do produto (lente, ponte e haste).
- Não garantimos correspondência perfeita entre tela e peça física.

## Disposições gerais
- Aplica-se a legislação brasileira.
- Consumidores podem recorrer aos órgãos de defesa do consumidor sempre que necessário.`,
  },
  {
    slug: "provador",
    title: "Como funciona o provador",
    content: `O provador usa rastreamento facial com IA no navegador (MediaPipe Face Landmarker) para posicionar o modelo 3D do produto sobre o seu rosto, em tempo real.

## Passo a passo
- Abra o provador por um produto com o selo "Provador 3D".
- Permita a câmera — com explicação clara do que acontece na sua tela.
- Centralize o rosto no guia; ajuste posição e escala se quiser.
- Troque a cor da armação, tire foto e compartilhe, se quiser.

## Privacidade
- Nada do vídeo ao vivo é armazenado ou enviado para servidores.
- Fotos salvas exigem seu clique; apague quando quiser em Minha conta.`,
  },
];

const SETTINGS: Record<string, string> = {
  announcement: `Frete grátis acima de R$ 299 • Até 6x sem juros • Provador virtual 3D`,
  freeShippingAbove: "299",
  whatsapp: "5511940028922",
  // Fase 14 — joias por grama (preço = gramas × cotação × 2,7). Editável no painel.
  goldPricePerGram: "420.00",
};

// ----------------------------- Execução -----------------------------
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function wipe() {
  // Ordem reversa de dependências (os onDelete: Cascade cobrem bastante,
  // mas limpamos explicitamente para garantir idempotência)
  const tables = [
    "auditLog", "tryOnEvent", "stockReservation", "stockMovement",
    "payment", "shipment", "orderItem", "order", "cartItem", "cart",
    "review", "favorite", "prescription", "lensPackage",
    "model3D", "productImage", "productVariant", "productTag",
    "collectionProduct", "product", "collection", "tag",
    "coupon", "category", "brand", "banner", "page", "setting",
    "session", "account", "verificationToken", "user",
  ] as const;

  const delegate = prisma as unknown as Record<
    string,
    { deleteMany: () => Promise<unknown> }
  >;

  for (const table of tables) {
    await delegate[table].deleteMany();
  }
}

async function main() {
  console.log("🌱 Limpando tabelas (seed de desenvolvimento)…");
  await wipe();

  console.log("🏷️ Marcas…");
  const brandRows = Object.fromEntries(
    await Promise.all(
      BRANDS.map((b) =>
        prisma.brand.create({
          data: { name: b.name, slug: slugify(b.name), description: b.description },
        }).then((r) => [b.name, r] as const),
      ),
    ),
  ) as Record<string, { id: string }>;

  console.log("🗂️ Categorias…");
  const catRows = Object.fromEntries(
    await Promise.all(
      CATEGORIES.map((c, i) =>
        prisma.category
          .create({
            data: {
              name: c.name,
              slug: c.slug,
              imageUrl: c.img,
              sortOrder: i,
              description: `${c.name} com atendimento óptico especializado.`,
            },
          })
          .then((r) => [c.name, r] as const),
      ),
    ),
  ) as Record<string, { id: string }>;

  console.log("👥 Usuários…");
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const customerHash = await bcrypt.hash("Cliente@1234", 10);
  await prisma.user.create({
    data: {
      name: "Administrador",
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  const customer = await prisma.user.create({
    data: {
      name: "Ana Cliente",
      email: CUSTOMER_EMAIL,
      passwordHash: customerHash,
      role: "CUSTOMER",
      emailVerified: new Date(),
      phone: "(11) 98888-7777",
    },
  });
  await prisma.address.create({
    data: {
      userId: customer.id,
      cep: "01310-100",
      street: "Av. Paulista",
      number: "1000",
      complement: "Sala 42",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      isDefault: true,
    },
  });

  console.log("🥇 Pacotes de lente, cupom, banner, settings e páginas…");
  await Promise.all(LENS_PACKAGES.map((l) => prisma.lensPackage.create({ data: l })));

  await prisma.coupon.create({
    data: {
      code: "PRIMEIRA15",
      description: "15% OFF na primeira compra (newsletter)",
      type: "PERCENT",
      value: 15,
      perUserLimit: 1,
      endsAt: new Date("2027-12-31"),
      active: true,
    },
  });

  await prisma.banner.create({ data: BANNER_HERO });
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.create({ data: { key, value } });
  }
  for (const p of PAGES) {
    await prisma.page.create({ data: { ...p, active: true } });
  }

  console.log("🛍️ Produtos, variações, imagens, estoque e avaliações…");
  let skuCounter = 1000;
  for (const p of PRODUCTS) {
    skuCounter += 1;
    const slug = slugify(`${p.brand}-${p.name}`);
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        sku: `PIE-${skuCounter}`,
        type: p.type,
        description: p.description,
        shortDescription: p.description.slice(0, 90) + "…",
        gender: p.gender,
        frameShape: p.shape ?? null,
        material: p.material,
        lensWidth: p.lens,
        bridge: p.bridge,
        temple: p.temple,
        weight: p.weight,
        price: p.price,
        comparePrice: p.comparePrice ?? null,
        isFeatured: p.featured ?? false,
        isNew: p.isNew ?? false,
        brandId: brandRows[p.brand].id,
        categoryId: catRows[p.category].id,
        seoTitle: `${p.name} — ${p.brand}`,
        seoDescription: `${p.name} da marca ${p.brand}. ${p.description}`.slice(0, 155),
      },
    });

    for (const [vi, v] of p.variants.entries()) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `PIE-${skuCounter}-${vi + 1}`,
          colorName: v.color,
          colorHex: v.hex,
          size: v.size ?? (p.lens ? `${p.lens}-${p.bridge}-${p.temple}` : null),
          stock: v.stock,
        },
      });
      await prisma.stockMovement.create({
        data: { variantId: variant.id, delta: v.stock, reason: "INITIAL" },
      });
    }

    // 3 imagens reais por produto (fotos de armações — ver eyewear-images.ts)
    const vistas = PRODUCT_IMAGES[slugify(p.name)];
    for (let i = 1; i <= 3; i++) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: vistas?.[i - 1] ?? `/produtos/${slug}-${i}.jpg`,
          alt: `${p.name} — vista ${i}`,
          position: i,
          isMain: i === 1,
        },
      });
    }

    // Avaliações de exemplo (aprovadas, compra verificada) nos featured
    if (p.featured) {
      const reviews = [
        { authorName: "Juliana M.", rating: 5, text: "Ficou perfeita no meu rosto, acabamento impecável e chegou rápido." },
        { authorName: "Pedro S.", rating: 4, text: "Muito confortável. Levei para ajustar numa loja e ninguém acreditou que foi online." },
        { authorName: "Bianca F.", rating: 5, text: "Comprei depois de experimentar no provador virtual — chegou igual à foto." },
      ];
      const chosen = reviews[(skuCounter + p.name.length) % reviews.length];
      await prisma.review.create({
        data: {
          productId: product.id,
          authorName: chosen.authorName,
          rating: chosen.rating,
          text: chosen.text,
          status: "APPROVED",
          verifiedPurchase: true,
        },
      });
    }
  }

  console.log("❤️ Favorito de exemplo do cliente…");
  await prisma.favorite.create({
    data: {
      userId: customer.id,
      productId: (await prisma.product.findFirst({ where: { name: "Caraíva Aviador" } }))!.id,
    },
  });

  const counts = {
    marcas: await prisma.brand.count(),
    categorias: await prisma.category.count(),
    produtos: await prisma.product.count(),
    variacoes: await prisma.productVariant.count(),
    usuarios: await prisma.user.count(),
    cupons: await prisma.coupon.count(),
    banners: await prisma.banner.count(),
    paginas: await prisma.page.count(),
  };

  console.log("\n✅ Seed concluído!");
  console.table(counts);
  console.log(`\n👤 Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`👤 Cliente:  ${CUSTOMER_EMAIL} / Cliente@1234`);
  console.log("⚠️  Troque as senhas default antes de entrar em produção.\n");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
