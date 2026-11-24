import { createClient } from "@/lib/supabase/server";
import { RoomsTimeline } from "@/components/reservations/rooms-timeline";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { ReservationsViewTracker } from "@/components/reservations/reservations-view-tracker";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import type { ReservationWithDetails } from "@/lib/reservations/types";

const MY_RESERVATIONS_LIMIT = 10;

export const metadata = {
  title: "Rezervace",
  description: "Celý den všech místností na jedné ose",
};

export default async function ReservationsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  const profileId = profile?.id ?? "";

  const [roomsResult, myReservationsResult] = await Promise.all([
    supabase.from("rooms").select("*").is("removed_at", null).order("code"),
    supabase
      .from("reservations")
      .select("*, room:rooms(id, code, name)")
      .eq("owner_profile_id", profileId)
      .is("cancelled_at", null)
      .gte("end_at", new Date().toISOString())
      .order("start_at")
      .limit(MY_RESERVATIONS_LIMIT),
  ]);

  return (
    <PageShell size="full" className="max-w-6xl">
      <ReservationsViewTracker />
      <PageHeader
        title="Rezervace"
        description="Vyber místnost a otevři její kalendář. Na počítači stačí táhnout přes volné místo na ose dne."
      />
      <ReservationsTabs myReservations={(myReservationsResult.data ?? []) as ReservationWithDetails[]} />
      <RoomsTimeline rooms={roomsResult.data ?? []} profileId={profileId} />
    </PageShell>
  );
}
