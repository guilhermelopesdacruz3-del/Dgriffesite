import { z } from "zod";
import type { FrameShape, Gender, ProductType } from "@prisma/client";

// ============================ Fase 6: formulários do admin ============================

/** Tipo/UF/valores aceitos — espelham os enums do schema Prisma. */
export const PRODUCT_TYPES = ["FRAMES", "SUNGLASSES", "CONTACT_LENSES", "ACCESSORIES"] as const satisfies readonly ProductType[];
export const GENDERS = ["FEMININE", "MASCULINE", "UNISEX", "KIDS"] as const satisfies readonly Gender[];
export const FRAME_SHAPES = ["ROUND", "SQUARE", "AVIATOR", "CAT_EYE", "RECTANGULAR", "OVAL", "BUTTERFLY", "WRAP"] as const satisfies readonly (FrameShape | "")[];

const priceField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${label}`)
    .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Use números: 199.90");

const optionalPrice = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(",", ".") : ""))
  .refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v), { message: "Preço inválido" });

/** Slug amigável derivado do nome se não informado (validação só do formato). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ------------------------------------------------------------------ Produto

export const productSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome").max(120),
  slug: z.string().trim().max(100).optional().default(""),
  sku: z.string().trim().max(40).optional().default(""),
  type: z.enum(PRODUCT_TYPES),
  gender: z.enum(GENDERS),
  frameShape: z
    .union([z.enum(FRAME_SHAPES), z.literal("")])
    .optional()
    .default(""),
  brandId: z.string().cuid("Escolha a marca"),
  categoryId: z.string().cuid("Escolha a categoria"),
  description: z.string().trim().min(10, "Descrição: no mínimo 10 caracteres"),
  shortDescription: z.string().trim().max(220).optional().default(""),
  material: z.string().trim().max(60).optional().default(""),
  lensWidth: z.string().trim().max(4).optional().default("").refine((v) => v === "" || /^\d{2,3}$/.test(v), "mm inválido"),
  bridge: z.string().trim().max(4).optional().default("").refine((v) => v === "" || /^\d{2,3}$/.test(v), "mm inválido"),
  temple: z.string().trim().max(4).optional().default("").refine((v) => v === "" || /^\d{2,3}$/.test(v), "mm inválido"),
  price: priceField("o preço"),
  comparePrice: optionalPrice,
  cost: optionalPrice,
  isFeatured: z.boolean().optional().default(false),
  isNew: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  seoTitle: z.string().trim().max(120).optional().default(""),
  seoDescription: z.string().trim().max(220).optional().default(""),

  // Variações sincronizadas (ids existentes preservados)
  variants: z
    .array(
      z.object({
        id: z.string().optional().default(""),
        sku: z.string().trim().max(40).optional().default(""),
        colorName: z.string().trim().max(60).optional().default(""),
        colorHex: z.string().trim().max(9).optional().default("").refine((v) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v), "Hex: #RRGGBB"),
        size: z.string().trim().max(30).optional().default(""),
        stock: z.coerce.number().int().min(0).max(100000),
        priceOverride: optionalPrice,
        active: z.boolean().optional().default(true),
      }),
    )
    .max(24),

  // Imagens sincronizadas (URL por enquanto; upload real na Fase 7)
  images: z
    .array(
      z.object({
        id: z.string().optional().default(""),
        url: z.string().trim().url("URL da imagem inválida"),
        alt: z.string().trim().max(120).optional().default(""),
        isMain: z.boolean().optional().default(false),
      }),
    )
    .max(12),
});
export type ProductInput = z.infer<typeof productSchema>;

// ------------------------------------------------------------------ Pedido

export const orderUpdateSchema = z.object({
  code: z.string().trim().min(3).max(20),
  status: z.enum([
    "AWAITING_PAYMENT",
    "AWAITING_PRESCRIPTION_VALIDATION",
    "PAID",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
  trackingCode: z.string().trim().max(60).optional().default(""),
});
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;

// ------------------------------------------------------------------ Cupom

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Informe o código")
    .max(30)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  description: z.string().trim().max(140).optional().default(""),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Número inválido"),
  minOrder: optionalPrice,
  maxUses: z.string().trim().optional().default("").refine((v) => v === "" || /^\d{1,6}$/.test(v), "Digite só números"),
  endsAt: z.string().trim().optional().default(""), // AAAA-MM-DD
  active: z.boolean().optional().default(true),
});
export type CouponInput = z.infer<typeof couponSchema>;

// ------------------------------------------------------------------ Pacote de lente

/** Fase 13 — lentes (óculos de grau / de contato) disponíveis no checkout. */
export const lensPackageSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da lente").max(80),
  description: z.string().trim().min(5, "Descrição: no mínimo 5 caracteres").max(400),
  price: priceField("o preço da lente"),
  active: z.boolean().optional().default(true),
  sortOrder: z
    .string()
    .trim()
    .optional()
    .default("0")
    .refine((v) => /^\d{1,3}$/.test(v), "Ordem: só números (0 a 999)"),
});
export type LensPackageInput = z.infer<typeof lensPackageSchema>;
