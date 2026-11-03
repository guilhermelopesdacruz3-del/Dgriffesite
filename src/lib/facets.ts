// Tipos de facetas do catálogo (compartilhados server <-> client).

export interface FacetsData {
  categorias: { slug: string; name: string; count: number }[];
  marcas: { slug: string; name: string; count: number }[];
  formatos: { slug: string; count: number }[]; // slug de URL ("cat-eye")
  generos: { slug: string; count: number }[]; // slug de URL ("infantil")
  cores: { key: string; name: string; hex: string; count: number }[];
  precos: { key: string; count: number }[]; // chaves de PRICE_BUCKETS
  provador: number; // total com provador 3D
}
