import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

// Variantes do design system — pill (arredondado), estilo premium sóbrio.
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2";

const variants = {
  primary: "bg-ink text-white hover:bg-ink/90",
  accent: "bg-accent-600 text-white hover:bg-accent-700",
  outline: "border border-ink text-ink hover:bg-ink hover:text-white",
  soft: "bg-accent-50 text-accent-700 hover:bg-accent-100",
  ghost: "text-ink hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-12 px-8 text-base",
} as const;

type Base = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
};

type ButtonAsLink = Base & { href: string } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className"
>;
type ButtonAsButton = Base & { href?: undefined } & Omit<
  ComponentProps<"button">,
  "className"
>;

export function Button(props: ButtonAsLink | ButtonAsButton) {
  const { variant = "primary", size = "md", className, ...rest } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if (rest.href) {
    return <Link {...(rest as ComponentProps<typeof Link>)} className={classes} />;
  }

  return (
    <button
      {...(rest as ComponentProps<"button">)}
      className={cn(classes, "cursor-pointer whitespace-nowrap")}
    />
  );
}
