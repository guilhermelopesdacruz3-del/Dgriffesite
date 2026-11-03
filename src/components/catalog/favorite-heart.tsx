"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleFavorite } from "@/actions/account";
import { setLocalFavorite } from "@/lib/favorites-store";
import { cn } from "@/lib/utils";

/**
 * Coração de favoritar (Fase 5): atualiza o estado local na hora e envia a
 * sincronização com a conta em segundo plano. Visitante mantém o toque
 * seulement local (`favorites-store` no localStorage).
 */
export function FavoriteHeart({
  slug,
  favorite = false,
  className,
}: {
  slug: string;
  /** Pre-acendido quando o produto já está favoritado na conta do cliente. */
  favorite?: boolean;
  className?: string;
}) {
  const [faved, setFaved] = useState(favorite);

  function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !faved;
    setFaved(next);
    // Local: sempre (visitante e logado) — a lista do catálogo reage na hora
    setLocalFavorite(slug, next);
    // Conta: fire-and-forget — falhar (sessão expirada) não afeta o toque
    toggleFavorite(slug).catch(() => null);
  }

  return (
    <button
      type="button"
      aria-label={faved ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={faved}
      onClick={onToggle}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-card transition-all hover:scale-105",
        faved ? "text-accent-600" : "text-stone-500 hover:text-ink",
        className,
      )}
    >
      <Heart size={17} fill={faved ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}
