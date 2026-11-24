import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession, homeFor } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/misc/profile-form";

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const s = await requireSession();
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link href={homeFor(s)} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <PageHeader title="Mi perfil" subtitle={s.email} />
      <ProfileForm initial={{ full_name: s.profile.full_name ?? "", notify_email: s.profile.notify_email, weekly_digest: s.profile.weekly_digest }} />
    </main>
  );
}
