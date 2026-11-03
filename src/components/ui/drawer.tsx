"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Drawer lateral acessível (a11y): fecha com ESC e bloqueia o scroll do fundo.
 * Renderizado via portal; animação de entrada simples e robusta em SSR.
 */
export function Drawer({ open, onClose, side = "right", title, children, className }: DrawerProps) {
  // Trava o scroll do body + fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelSide =
    side === "left"
      ? "left-0 h-full animate-slide-in-left rounded-r-2xl"
      : "right-0 h-full animate-slide-in-right rounded-l-2xl";

  return createPortal(
    // Overlay
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Painel */}
      <div
        className={cn(
          "absolute top-0 flex w-full max-w-md flex-col bg-white shadow-drawer outline-none",
          panelSide,
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="font-serif text-lg">{title}</div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
