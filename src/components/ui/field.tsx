import { cn } from "@/lib/utils";
import type {
  ComponentProps,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// ---------------- Rótulos ----------------
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-sm font-medium text-ink", className)}
      {...props}
    />
  );
}

// Mensagem de erro padrão dos campos
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-red-600">{children}</p>;
}

// Mensagem de ajuda
export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-stone-500">{children}</p>;
}

// ---------------- Input ----------------
const fieldClass =
  "block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-[15px] text-ink placeholder:text-stone-400 focus:border-accent-600 focus:outline-none focus:ring-1 focus:ring-accent-600 disabled:bg-stone-100";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-28", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, "appearance-none pr-10", className)} {...props} />
  );
}

// ---------------- Checkbox ----------------
export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-stone-300 text-accent-600 accent-accent-600",
        className,
      )}
      {...props}
    />
  );
}
