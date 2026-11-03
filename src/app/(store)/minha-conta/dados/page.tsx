import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  PasswordForm,
  PreferencesForm,
  ProfileForm,
} from "@/components/account/profile-forms";
import { LgpdPanel } from "@/components/account/lgpd-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dados e senha" };

/** Fase 5 — perfil do cliente, senha e preferências LGPD. */
export default async function AccountDataPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      phone: true,
      document: true,
      passwordHash: true,
      marketingOptIn: true,
      tryOnPhotosOpt: true,
    },
  });
  if (!user) return null;

  return (
    <div>
      <h1 className="font-serif text-3xl leading-tight">Dados e senha</h1>
      <p className="mt-2 text-sm text-stone-500">Conta: {user.email}</p>

      <div className="mt-8 grid max-w-3xl gap-6">
        <ProfileForm
          name={user.name}
          phone={user.phone}
          documentValue={user.document}
        />
        <PreferencesForm
          marketingOptIn={user.marketingOptIn}
          tryOnPhotosOpt={user.tryOnPhotosOpt}
        />
        <PasswordForm hasPassword={Boolean(user.passwordHash)} />
        <LgpdPanel />
      </div>
    </div>
  );
}
