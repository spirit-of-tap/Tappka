import { createClient } from "@/lib/supabase/server";
import { RoomsTimeline } from "@/components/reservations/rooms-timeline";
import { ReservationsViewTracker } from "@/components/reservations/reservations-view-tracker";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = {
  title: "Rezervace",
  description: "Celý den všech místností na jedné ose",
};

export default async function ReservationsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);

  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .is("removed_at", null)
    .order("code");

  return (
    <PageShell size="full" className="max-w-6xl">
      <ReservationsViewTracker />
      <PageHeader
        title="Rezervace"
        description="Celý den všech místností na jedné ose. Klikni na místnost a v jejím kalendáři si ji zarezervuješ."
      />
      <RoomsTimeline rooms={rooms ?? []} profileId={profile?.id ?? ""} />
    </PageShell>
  );
}
