// Tipos compartilhados de catálogo entre servidor e componentes de UI.

export interface ProductCardData {
  id?: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  comparePrice?: number | null;
  images: string[];
  colors: { name: string; hex: string }[];
  has3d: boolean;
  isNew?: boolean;
  // Metadados extras usados pela filtragem do catálogo (fallback sem banco
  // e contagens de facetas). Card não renderiza nada disso.
  categorySlug?: string;
  gender?: string; // FEMININE | MASCULINE | UNISEX | KIDS
  shape?: string; // ROUND | SQUARE | AVIATOR | ... (enum FrameShape)
  type?: string; // FRAMES | SUNGLASSES | CONTACT_LENSES | ACCESSORIES
}

/** Detalhe completo para a página do produto (PDP). */
export interface ProductDetailData {
  id: string;
  slug: string;
  name: string;
  brand: { name: string; slug: string };
  category: { name: string; slug: string };
  type: string;
  gender: string;
  description: string;
  shortDescription: string | null;
  price: number;
  comparePrice: number | null;
  sku: string;
  isNew: boolean;
  has3d: boolean;
  // Especificações (medidas em mm)
  material: string | null;
  lensWidth: number | null;
  bridge: number | null;
  temple: number | null;
  weight: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  // Galeria: imagens do produto (sem variação) + por variação
  images: { url: string; alt?: string | null; variantId?: string | null }[];
  // Variações de cor/tamanho com estoque
  variants: {
    id: string;
    colorName: string | null;
    colorHex: string | null;
    size: string | null;
    stock: number;
    priceOverride: number | null;
    images: { url: string; alt?: string | null }[];
  }[];
  /** Pacotes de lentes ativos — apenas para armação de grau (Fase 7b). */
  lensPackages?: { id: string; name: string; description: string; price: number }[];
}
