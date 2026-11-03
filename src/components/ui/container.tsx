import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Container padrão de largura editorial (estilo premium, bordas generosas). */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 md:px-8", className)}
      {...props}
    />
  );
}
