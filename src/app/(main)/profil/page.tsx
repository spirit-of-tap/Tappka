import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/komunita/types";
import { ProfileHub } from "@/components/navigation/profile-hub";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = {
  title: "Profil",
  description: "Tvůj účet, přístupy a nastavení aplikace",
};

export default async function ProfilPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  return (
    <PageShell size="medium">
      <PageHeader
        title="Profil"
        description="Tvůj účet, přístupy a nastavení aplikace"
      />
      <ProfileHub
        user={{
          id: profile.id,
          name: profile.name ?? "",
          email: profile.work_email,
          // Raw storage ref — ProfileHub resolves it via getAvatarUrl.
          picture: profile.picture,
          // profile.role is a non-null profile_role enum value, so it is always
          // a ROLE_LABELS key — no fallback needed.
          role: ROLE_LABELS[profile.role],
          beta_access: profile.beta_access_granted_at != null,
        }}
      />
    </PageShell>
  );
}
