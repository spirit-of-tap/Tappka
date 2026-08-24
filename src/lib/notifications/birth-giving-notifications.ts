import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send-email";

interface BirthGivingEmailContext {
  eventName: string;
  customer: string;
  eventUrl: string;
}

/**
 * The event columns the cron reads directly on `birth_giving_events` through
 * the admin (service-role) client. Service role bypasses RLS and the column
 * grants, so the embargoed `assignment_*` metadata is readable here without
 * exposing it to `authenticated` callers.
 */
const ASSIGNMENT_RELEASE_EVENT_COLUMNS = [
  "id",
  "name",
  "customer",
  "status",
  "starts_at",
  "removed_at",
  "assignment_state",
  "assignment_uploaded_at",
] as const;

interface AssignmentReleaseEvent {
  id: string;
  name: string;
  customer: string;
  status: "draft" | "published";
  starts_at: string;
  removed_at: string | null;
  assignment_state: "none" | "missing" | "present";
  assignment_uploaded_at: string | null;
}

interface AssignmentReleaseMember {
  profile: { user: { verified_work_email: string | null } };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function assignmentReleaseEmail(ctx: BirthGivingEmailContext) {
  const title = "Zadání je dostupné";
  const introduction = "Zadání pro Birth Giving je nyní dostupné. Otevřete si detail události a můžete začít.";
  return {
    subject: `${title}: ${ctx.eventName}`,
    html: `<!doctype html>
<html lang="cs"><body>
  <h1>${title}</h1>
  <p>${introduction}</p>
  <p><strong>${escapeHtml(ctx.eventName)}</strong><br>${escapeHtml(ctx.customer)}</p>
  <p><a href="${escapeHtml(ctx.eventUrl)}">Otevřít zadání v Tappce</a></p>
</body></html>`,
  };
}

/**
 * Notifies the current members of an event that its assignment is available.
 * Sends only while the assignment is actually released: the event must be
 * published, not removed, already started (`starts_at <= now()`), and carry a
 * `present` assignment, so drafts, future events, and replaced-but-not-yet
 * started assignments never advertise early.
 *
 * The provider idempotency key includes the assignment's upload timestamp, so
 * re-confirming a replacement assignment produces a new send while repeated
 * runs for the same event/recipient are deduped at the provider. There is no
 * local delivery-tracking table; one recipient's failure never aborts the
 * remaining recipients.
 */
export async function notifyParticipantsOfAssignment(eventId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: rawEvent } = await admin
    .from("birth_giving_events")
    .select(ASSIGNMENT_RELEASE_EVENT_COLUMNS.join(", "))
    .eq("id", eventId)
    .maybeSingle();

  const event = (rawEvent ?? null) as unknown as AssignmentReleaseEvent | null;
  if (!event) return 0;
  if (event.status !== "published" || event.removed_at !== null) return 0;
  if (event.assignment_state !== "present" || !event.assignment_uploaded_at) return 0;
  if (Date.parse(event.starts_at) > Date.now()) return 0;

  const { data: members } = await admin
    .from("birth_giving_team_members")
    .select("profile:profiles!inner(user:users!inner(verified_work_email))")
    .eq("event_id", eventId);

  const baseUrl = process.env.APP_URL ?? process.env.SITE_URL ?? "https://tappka.cz";
  const eventUrl = `${baseUrl}/birth-giving/${eventId}`;
  const emailContent = assignmentReleaseEmail({
    eventName: event.name,
    customer: event.customer,
    eventUrl,
  });

  let sent = 0;
  for (const m of (members ?? []) as unknown as AssignmentReleaseMember[]) {
    const email = m.profile?.user?.verified_work_email;
    if (!email) continue;
    try {
      await sendEmail(
        {
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
        },
        {
          idempotencyKey: `bg-assignment-${eventId}-${event.assignment_uploaded_at}-${email}`,
        },
      );
      sent += 1;
    } catch (err) {
      console.error(`Failed to send assignment email to ${email}:`, err);
    }
  }

  return sent;
}

/**
 * Cron entry point: processes all currently released Birth Giving assignments.
 * Enumerates published, non-removed events whose assignment is `present` and
 * whose start has passed, then notifies each event's current members. The
 * helper re-checks the release conditions for the event (an event may have
 * changed since enumeration) and returns 0 when nothing is due.
 */
export async function processBirthGiving(): Promise<{ sent: number }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: rawEvents } = await admin
    .from("birth_giving_events")
    .select("id")
    .eq("status", "published")
    .is("removed_at", null)
    .eq("assignment_state", "present")
    .lte("starts_at", now);

  const events = (rawEvents ?? []) as unknown as Array<{ id: string }>;

  let sent = 0;
  for (const event of events) {
    sent += await notifyParticipantsOfAssignment(event.id);
  }

  return { sent };
}