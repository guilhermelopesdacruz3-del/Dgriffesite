import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

const variants = {
  neutral: "bg-stone-100 text-stone-700",
  accent: "bg-accent-600 text-white",
  // Selo "Novo" e etiquetas escuras
  ink: "bg-ink text-white",
  // Selo de desconto ("promoção")
  sale: "bg-accent-50 text-accent-700",
  outline: "border border-stone-300 text-stone-600",
} as const;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
