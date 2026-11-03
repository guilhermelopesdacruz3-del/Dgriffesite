/**
 * ============================================================
 * IDENTIDADE E CONFIGURAÇÃO DA LOJA — PONTO ÚNICO DE EDIÇÃO
 * ============================================================
 * Para trocar o nome/contato da loja, altere APENAS aqui.
 * `name` também pode ser sobrescrito por NEXT_PUBLIC_STORE_NAME.
 * Configurações dinâmicas (anúncio, frete grátis) ficam no banco
 * (tabela Setting) editáveis pelo admin.
 */
export const storeConfig = {
  /** ⬇️ NOME ÚNICO DA LOJA (mude aqui) */
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Pierre",
  shortName: process.env.NEXT_PUBLIC_STORE_NAME ?? "Pierre",
  legalName: "Pierre Ótica Ltda.",
  cnpj: "12.345.678/0001-00", // (placeholder) substitua pelo CNPJ real antes do lançamento
  legalAddress: "Av. Paulista, 1000 — Bela Vista, São Paulo/SP — CEP 01310-100",

  tagline: "Armações, óculos de sol e lentes com atendimento óptico de verdade.",

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  contact: {
    phone: "(11) 4002-8922",
    whatsapp: "5511940028922", // usado no link wa.me
    whatsappDisplay: "(11) 94002-8922",
    email: "contato@otica.com.br",
    hours: "Seg a Sáb, 9h às 19h",
  },

  social: [
    { name: "Instagram", href: "https://instagram.com/" },
    { name: "Facebook", href: "https://facebook.com/" },
    { name: "YouTube", href: "https://youtube.com/" },
  ],

  // Lojas físicas (exibidas em /paginas/lojas);
  // podem também ser editadas como página no admin.
  stores: [
    {
      name: "Pierre Paulista",
      address: "Av. Paulista, 1000 — Bela Vista",
      city: "São Paulo/SP",
      phone: "(11) 4002-8922",
      hours: "Seg a Sáb, 9h às 19h",
    },
    {
      name: "Pierre Shopping Iguatemi",
      address: "Av. Brig. Faria Lima, 2232 — Jardim Paulistano",
      city: "São Paulo/SP",
      phone: "(11) 4002-8933",
      hours: "Seg a Dom, 10h às 22h",
    },
  ],

  commerce: {
    freeShippingAbove: 299, // R$
    maxInstallments: 6, // parcelamento sem juros
    minParcelValue: 40, // menor parcela aceita
    exchangeDays: 30,
    warranty: 12, // meses
    stockReservationMinutes: 20, // reserva de estoque durante pagamento
    firstPurchaseCoupon: "PRIMEIRA15",
  },

  // Menu principal (rótulos pt-BR; links compatíveis com as rotas da loja)
  nav: [
    { label: "Óculos de grau", href: "/produtos?tipo=grau" },
    { label: "Óculos de sol", href: "/produtos?tipo=sol" },
    { label: "Lentes de contato", href: "/produtos?tipo=lentes-de-contato" },
    { label: "Marcas", href: "/marcas" },
    { label: "Lojas", href: "/paginas/lojas" },
  ],
} as const;

export type StoreConfig = typeof storeConfig;
