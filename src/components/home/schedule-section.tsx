import { CalendarCheck, Eye, Glasses } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { storeConfig } from "@/lib/config";

// Serviços oferecidos nas lojas físicas (CTA via WhatsApp, editável no config).
const services = [
  { icon: Eye, label: "Exame de vista com agendamento" },
  { icon: Glasses, label: "Moldagem de armações e ajustes" },
  { icon: CalendarCheck, label: "Substituição de lentes sob receita" },
];

export function ScheduleSection() {
  const wa = `https://wa.me/${storeConfig.contact.whatsapp}?text=${encodeURIComponent("Olá! Quero agendar um exame de vista.")}`;

  return (
    <section className="py-16 md:py-20">
      <Container>
        <div className="grid overflow-hidden rounded-3xl border border-stone-200 md:grid-cols-2">
          {/* Texto */}
          <div className="p-8 md:p-12">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Atendimento presencial
            </p>
            <h2 className="font-serif text-3xl leading-tight md:text-4xl">
              Agende seu exame de vista
            </h2>
            <p className="mt-3 text-stone-600">
              Exame completo em até 45 minutos, com avaliação de lentes na hora.
              Traga sua receita atual e os óculos que você já usa.
            </p>
            <ul className="mt-6 space-y-3">
              {services.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                    <s.icon size={15} aria-hidden />
                  </span>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Card de contato */}
          <div className="flex flex-col justify-center bg-ink p-8 text-white md:p-12">
            <h3 className="font-serif text-2xl">{storeConfig.name}</h3>
            <p className="mt-1 text-sm text-white/70">{storeConfig.contact.hours}</p>
            <div className="mt-6 space-y-1 text-sm">
              <p className="font-medium">{storeConfig.contact.phone}</p>
              <p className="text-white/70">{storeConfig.contact.email}</p>
            </div>
            <div className="mt-8">
              <Button href={wa} variant="accent" className="w-full sm:w-auto">
                Agendar pelo WhatsApp →
              </Button>
              <p className="mt-3 text-xs text-white/60">
                Prefere ligar? {storeConfig.contact.whatsappDisplay}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
