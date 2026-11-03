import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Breadcrumbs acessíveis (usados em catálogo, produto e páginas). */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Você está aqui" className={cn("flex flex-wrap items-center gap-1 text-sm text-stone-500", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} aria-hidden />}
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-accent-600">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-ink" : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
