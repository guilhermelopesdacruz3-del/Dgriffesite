"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { saveProduct, deleteProduct } from "@/actions/admin/products";
import {
  productSchema,
  FRAME_SHAPES,
  GENDERS,
  PRODUCT_TYPES,
  type ProductInput,
} from "@/lib/validators/admin";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";

/** Linha do produto como recebida da página (já serializável). */
export type ProductStatusData = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  type: ProductInput["type"];
  gender: ProductInput["gender"];
  frameShape: string | null;
  brandId: string;
  categoryId: string;
  description: string;
  shortDescription: string | null;
  material: string | null;
  lensWidth: number | null;
  bridge: number | null;
  temple: number | null;
  price: string;
  comparePrice: string | null;
  cost: string | null;
  isFeatured: boolean;
  isNew: boolean;
  active: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: {
    id: string;
    sku: string;
    colorName: string | null;
    colorHex: string | null;
    size: string | null;
    stock: number;
    priceOverride: string | null;
  }[];
  images: { id: string; url: string; alt: string | null; isMain: boolean }[];
};

/**
 * Fase 6 — formulário completo do produto: identificação, preços,
 * especificações, variações de cor (estoque por cor) e imagens por URL
 * (upload real chega na Fase 7 com armazenamento de arquivos).
 */

const TYPE_LABELS: Record<string, string> = {
  FRAMES: "Armação de grau",
  SUNGLASSES: "Óculos de sol",
  CONTACT_LENSES: "Lentes de contato",
  ACCESSORIES: "Acessórios",
};

const GENDER_LABELS: Record<string, string> = {
  FEMININE: "Feminino",
  MASCULINE: "Masculino",
  UNISEX: "Unissex",
  KIDS: "Infantil",
};

const SHAPE_LABELS: Record<string, string> = {
  AVIATOR: "Aviador",
  BUTTERFLY: "Borboleta",
  CAT_EYE: "Gatinho",
  OVAL: "Oval",
  RECTANGULAR: "Retangular",
  ROUND: "Redondo",
  SQUARE: "Quadrado",
  WRAP: "Esportivo",
  "": "—",
};

export function ProductForm({
  product,
  brands,
  categories,
}: {
  product: ProductStatusData | null;
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Upload real de imagens (Fase 7) — só habilitado com produto já salvo. */
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  async function uploadImage(file: File) {
    setImgError(null);
    setImgUploading(true);
    try {
      const form = new FormData();
      form.append("productId", product!.id!);
      form.append("file", file);
      const res = await fetch("/api/admin/files/upload", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (!res.ok || !data.ok || !data.url) {
        setImgError(data.message ?? "Falha no envio da imagem.");
        return;
      }
      // Entra na lista com o nome do arquivo como alt (editável pelo admin).
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      images.append({ id: "", url: data.url, alt, isMain: images.fields.length === 0 });
    } catch {
      setImgError("Rede interrompida — tente novamente.");
    } finally {
      setImgUploading(false);
    }
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          type: product.type,
          gender: product.gender,
          frameShape: (product.frameShape ?? "") as ProductInput["frameShape"],
          brandId: product.brandId,
          categoryId: product.categoryId,
          description: product.description,
          shortDescription: product.shortDescription ?? "",
          material: product.material ?? "",
          lensWidth: product.lensWidth ? String(product.lensWidth) : "",
          bridge: product.bridge ? String(product.bridge) : "",
          temple: product.temple ? String(product.temple) : "",
          price: product.price,
          comparePrice: product.comparePrice ?? "",
          cost: product.cost ?? "",
          isFeatured: product.isFeatured,
          isNew: product.isNew,
          active: product.active,
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            colorName: v.colorName ?? "",
            colorHex: v.colorHex ?? "",
            size: v.size ?? "",
            stock: v.stock,
            priceOverride: v.priceOverride ?? "",
            active: true,
          })),
          images: product.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt ?? "",
            isMain: i.isMain,
          })),
        }
      : {
          name: "",
          slug: "",
          sku: "",
          type: "FRAMES",
          gender: "UNISEX",
          frameShape: "ROUND",
          brandId: brands[0]?.id ?? "",
          categoryId: categories[0]?.id ?? "",
          description: "",
          shortDescription: "",
          material: "",
          lensWidth: "",
          bridge: "",
          temple: "",
          price: "",
          comparePrice: "",
          cost: "",
          isFeatured: false,
          isNew: false,
          active: true,
          seoTitle: "",
          seoDescription: "",
          variants: [{ id: "", sku: "", colorName: "", colorHex: "", size: "", stock: 0, priceOverride: "", active: true }],
          images: [],
        },
  });

  const variants = useFieldArray({ control, name: "variants" });
  const images = useFieldArray({ control, name: "images" });

  async function onSubmit(values: ProductInput) {
    setError(null);
    setFeedback(null);
    const res = await saveProduct(values, product?.id);
    if (res.ok) {
      setFeedback("Produto salvo ✓");
      router.push("/admin/produtos");
    } else {
      setError(res.error);
    }
  }

  const categoryOptions = categories;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* -------- Identificação -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-serif text-lg">Identificação</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="p-name">Nome</Label>
            <Input id="p-name" className="mt-1.5" {...register("name")} />
            <FieldError>{errors.name?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-slug">Slug (URL)</Label>
            <Input id="p-slug" className="mt-1.5 font-mono" placeholder="automático pelo nome" {...register("slug")} />
            <FieldHint>Deixe vazio para gerar pelo nome. Ex.: lumen-aura-redonda</FieldHint>
          </div>
          <div>
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" className="mt-1.5 font-mono" placeholder="automático" {...register("sku")} />
          </div>
          <div>
            <Label htmlFor="p-type">Tipo</Label>
            <select id="p-type" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("type")}>
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-gender">Público</Label>
            <select id="p-gender" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("gender")}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-shape">Formato da armação</Label>
            <select id="p-shape" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("frameShape")}>
              {FRAME_SHAPES.map((s) => (
                <option key={s} value={s}>{SHAPE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-brand">Marca</Label>
            <select id="p-brand" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("brandId")}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <FieldError>{errors.brandId?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="p-category">Categoria</Label>
            <select id="p-category" className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px]" {...register("categoryId")}>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError>{errors.categoryId?.message}</FieldError>
          </div>
        </div>
      </section>

      {/* -------- Descrição -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-serif text-lg">Descrição</h2>
        <div className="mt-5 grid gap-4">
          <div>
            <Label htmlFor="p-short">Resumo (exibido no topo da PDP)</Label>
            <Input id="p-short" className="mt-1.5" {...register("shortDescription")} />
          </div>
          <div>
            <Label htmlFor="p-desc">Descrição completa</Label>
            <textarea
              id="p-desc"
              rows={5}
              className="mt-1.5 block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-[15px] focus:border-accent-600 focus:outline-none"
              {...register("description")}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-material">Material</Label>
            <Input id="p-material" className="mt-1.5" placeholder="acetato, metal, TR90…" {...register("material")} />
          </div>
        </div>
      </section>

      {/* -------- Preços + especificações -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-serif text-lg">Preços e especificações</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="p-price">Preço (R$)</Label>
            <Input id="p-price" className="mt-1.5" inputMode="decimal" placeholder="199.90" {...register("price")} />
            <FieldError>{errors.price?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-compare">Preço “de” (promoção)</Label>
            <Input id="p-compare" className="mt-1.5" inputMode="decimal" placeholder="259.90" {...register("comparePrice")} />
            <FieldError>{errors.comparePrice?.message?.replace("Preço", "Preço “de”")}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-cost">Custo interno (não exibe)</Label>
            <Input id="p-cost" className="mt-1.5" inputMode="decimal" {...register("cost")} />
            <FieldError>{errors.cost?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-lens">Lente (mm)</Label>
            <Input id="p-lens" className="mt-1.5" inputMode="numeric" {...register("lensWidth")} />
            <FieldError>{errors.lensWidth?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-bridge">Ponte (mm)</Label>
            <Input id="p-bridge" className="mt-1.5" inputMode="numeric" {...register("bridge")} />
            <FieldError>{errors.bridge?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="p-temple">Haste (mm)</Label>
            <Input id="p-temple" className="mt-1.5" inputMode="numeric" {...register("temple")} />
            <FieldError>{errors.temple?.message}</FieldError>
          </div>
        </div>
      </section>

      {/* -------- Variações -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Variações (cores e estoque)</h2>
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => variants.append({ id: "", sku: "", colorName: "Preto", colorHex: "#111111", size: "", stock: 0, priceOverride: "", active: true })}
          >
            + Adicionar cor
          </Button>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          O estoque por cor aparece no checkout. Mudanças ficam registradas no histórico.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          {variants.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Cor</small>
                <Input className="mt-1" {...register(`variants.${index}.colorName`)} />
              </div>
              <div className="sm:col-span-2">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Hex (#RRGGBB)</small>
                <Input className="mt-1 font-mono" {...register(`variants.${index}.colorHex`)} />
                <FieldError>{errors.variants?.[index]?.colorHex?.message}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tamanho</small>
                <Input className="mt-1" placeholder="53-17-145" {...register(`variants.${index}.size`)} />
              </div>
              <div className="sm:col-span-2">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Estoque</small>
                <Input className="mt-1" inputMode="numeric" type="number" min={0} {...register(`variants.${index}.stock`, { valueAsNumber: true })} />
                <FieldError>{errors.variants?.[index]?.stock?.message}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Preço próprio</small>
                <Input className="mt-1" inputMode="decimal" {...register(`variants.${index}.priceOverride`)} />
              </div>
              <div className="flex items-end justify-end sm:col-span-1">
                <button
                  type="button"
                  onClick={() => variants.remove(index)}
                  className="cursor-pointer rounded-full px-2 py-2 text-red-600 transition-colors hover:bg-red-50"
                  aria-label={`Remover variação ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------- Imagens -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Imagens</h2>
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => images.append({ id: "", url: "", alt: "", isMain: images.fields.length === 0 })}
          >
            + Adicionar imagem
          </Button>
        </div>
        <FieldHint>
          Envie do computador (arquivo entra no armazenamento da loja) ou cole um
          link. A primeira imagem marcada como "Principal" é a foto do card.
        </FieldHint>

        {product?.id && (
          <div className="mt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-accent-600 hover:text-accent-700">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={imgUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadImage(file);
                }}
              />
              {imgUploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden /> Enviando…
                </>
              ) : (
                <>Fazer upload (até 8 MB)</>
              )}
            </label>
            {imgError && <p className="mt-1 text-xs text-red-700">{imgError}</p>}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {images.fields.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
              Nenhuma imagem — o card da loja ficará sem foto.
            </p>
          )}
          {images.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">URL</small>
                <Input className="mt-1" placeholder="https://…" {...register(`images.${index}.url`)} />
                <FieldError>{errors.images?.[index]?.url?.message}</FieldError>
              </div>
              <div className="sm:col-span-3">
                <small className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">Alt (acessibilidade)</small>
                <Input className="mt-1" {...register(`images.${index}.alt`)} />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-accent-600"
                    {...register(`images.${index}.isMain`)}
                  />
                  Principal
                </label>
                <button
                  type="button"
                  onClick={() => images.remove(index)}
                  className="ml-auto cursor-pointer rounded-full px-2 py-2 text-red-600 hover:bg-red-50"
                  aria-label={`Remover imagem ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------- Sinalização + SEO -------- */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="font-serif text-lg">Sinalização e SEO</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-accent-600" {...register("active")} />
            Ativo na loja
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-accent-600" {...register("isFeatured")} />
            Destaque (mais vendidos)
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-accent-600" {...register("isNew")} />
            Selo “Novo”
          </label>
          <div className="sm:col-span-3">
            <Label htmlFor="p-seo-title">Título SEO</Label>
            <Input id="p-seo-title" className="mt-1.5" {...register("seoTitle")} />
          </div>
          <div className="sm:col-span-3">
            <Label htmlFor="p-seo-desc">Descrição SEO</Label>
            <Input id="p-seo-desc" className="mt-1.5" {...register("seoDescription")} />
          </div>
        </div>
      </section>

      {/* -------- Ações -------- */}
      <div className="flex items-center gap-4">
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : product ? "Salvar alterações" : "Criar produto"}
        </Button>
        {feedback && <span className="text-sm font-medium text-green-700">{feedback}</span>}
        <FieldError>{error}</FieldError>
      </div>
    </form>
  );
}

/** Exclusão lógica com confirmação em duas etapas. */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return confirming ? (
    <div className="flex items-center gap-2">
      <Button
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await deleteProduct(id);
          setBusy(false);
          if (res.ok) router.push("/admin/produtos");
        }}
      >
        Confirmar exclusão
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
      <span className="text-xs text-stone-500">{name} sai da loja mas mantém o histórico.</span>
    </div>
  ) : (
    <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
      Excluir produto
    </Button>
  );
}
