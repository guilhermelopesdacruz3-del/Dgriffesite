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
  name: process.env.NEXT_PUBLIC_STORE_NAME ?? "D'Griffe",
  shortName: process.env.NEXT_PUBLIC_STORE_NAME ?? "D'Griffe",
  legalName: "D'Griffe Ltda.",
  cnpj: "12.345.678/0001-00", // (placeholder) substitua pelo CNPJ real antes do lançamento
  legalAddress:
    "Avenida Paraguassu, 2950 — Capão da Canoa, Rio Grande do Sul — CEP 95555-000",

  tagline: "Armações, óculos de sol e lentes com atendimento óptico de verdade.",

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  contact: {
    phone: "(51) 4002-8922", // (placeholder) telefone/DDD reais antes do lançamento
    whatsapp: "5551940028922", // usado no link wa.me (placeholder)
    whatsappDisplay: "(51) 94002-8922",
    email: "contato@dgriffe.com.br", // (placeholder) domínio real antes do lançamento
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
      name: "D'Griffe — Capão da Canoa",
      address: "Avenida Paraguassu, 2950",
      city: "Capão da Canoa/RS — CEP 95555-000",
      phone: "(51) 4002-8922",
      hours: "Seg a Sáb, 9h às 19h",
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
