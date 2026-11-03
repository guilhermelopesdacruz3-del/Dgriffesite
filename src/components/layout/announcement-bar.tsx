import { Container } from "@/components/ui/container";

/** Barra de aviso no topo (texto editável via admin → Setting "announcement"). */
export function AnnouncementBar({ message }: { message: string }) {
  return (
    <div className="bg-ink py-2 text-white">
      <Container className="text-center text-xs font-medium tracking-wide md:text-[13px]">
        {message}
      </Container>
    </div>
  );
}
