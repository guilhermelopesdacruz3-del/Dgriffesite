import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number; // 0..5 (aceita frações)
  className?: string;
  size?: number;
}

/** Estrelas de avaliação (exibição estática — formulário na Fase 5). */
export function StarRating({ value, size = 16, className }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-stone-300" fill="currentColor" strokeWidth={0} />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? "100%" : "50%" }}
              >
                <Star size={size} className="text-amber-500" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
