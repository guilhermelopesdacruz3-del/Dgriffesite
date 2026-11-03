import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AddressManager, type AddressItem } from "@/components/account/address-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Endereços" };

/** Fase 5 — endereços de entrega do cliente (CRUD com padrão). */
export default async function AccountAddressesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const rows = await db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      cep: true,
      street: true,
      number: true,
      complement: true,
      district: true,
      city: true,
      state: true,
      isDefault: true,
      receiverName: true,
      phone: true,
    },
  });

  // Alinha com o shape serializável do EndereçosManager (Decimal/null não vem).
  const addresses: AddressItem[] = rows.map((r) => ({ ...r }));

  return (
    <div>
      <h1 className="font-serif text-3xl leading-tight">Endereços</h1>
      <p className="mt-2 mb-8 text-sm text-stone-500">
        Usados no checkout — o padrão vem selecionado.
      </p>

      <div className="max-w-3xl">
        <AddressManager addresses={addresses} />
      </div>
    </div>
  );
}
