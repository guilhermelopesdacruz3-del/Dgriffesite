import { cn } from "@/lib/utils";

/** Cabeçalho de seção editorial: título serif opcional + "ver tudo". */
export function SectionHeader({
  title,
  subtitle,
  action,
  center,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        center && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div>
        <h2 className="font-serif text-3xl md:text-4xl leading-tight">{title}</h2>
        {subtitle && <p className="mt-2 text-stone-500 max-w-xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
