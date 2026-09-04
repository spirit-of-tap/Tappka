import type { Tables } from "@/lib/supabase/tables";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send-email";
import { serverLogger } from "@/lib/server-logger";

interface BirthGivingEmailContext {
  eventName: string;
  customer: string;
  eventUrl: string;
}

/** Stable provider idempotency-key prefix for assignment-release emails. */
const ASSIGNMENT_EMAIL_KEY_PREFIX = "bg-assignment";

/** Origin used when neither `APP_URL` nor `SITE_URL` is configured. */
const FALLBACK_APP_URL = "https://tappka.cz";

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
  "assignment_storage_path",
] as const;

/**
 * The event row `notifyParticipantsOfAssignment` reads. Everything except the
 * `assignment_*` columns comes from the generated `Tables` types; those three
 * columns are not in `database.types.ts` yet (the file predates the assignment
 * metadata and is regenerated later), so they are appended here and the row is
 * snapshot-typed via `as unknown as` at the query site.
 */
type AssignmentReleaseEvent = Pick<
  Tables<"birth_giving_events">,
  "id" | "name" | "customer" | "status" | "starts_at" | "removed_at"
> & {
  assignment_state: "none" | "missing" | "present";
  assignment_uploaded_at: string | null;
  assignment_storage_path: string | null;
};

/**
 * A current team member joined to their profile. The service-role client
 * bypasses RLS, so recipient gating mirrors the app's profile activeness rule
 * (`access_removed_at IS NULL` and `beta_access_granted_at IS NOT NULL`) in
 * code instead of relying on the database.
 */
type AssignmentReleaseMember = {
  profile: Pick<Tables<"profiles">, "access_removed_at" | "beta_access_granted_at"> & {
    beta_cohort?: string | null;
    user: Pick<Tables<"users">, "verified_work_email">;
  };
};

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
 * The provider idempotency key is keyed on the assignment's storage path
 * rather than its upload timestamp: re-confirming the same object (a retry or
 * a double-submit) refreshes `assignment_uploaded_at` but keeps the path, so
 * the reuse of the same key dedupes the send at the provider, while a genuine
 * replacement (a new path) produces a new key and thus a new send. There is no
 * local delivery-tracking table; one recipient's failure never aborts the
 * remaining recipients.
 *
 * Query failures are surfaced (thrown) instead of being swallowed: an event or
 * member lookup that fails must not degrade into a silently successful zero-
 * send, which a cron would otherwise record as "nothing to do".
 */
export async function notifyParticipantsOfAssignment(eventId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: rawEvent, error: eventError } = await admin
    .from("birth_giving_events")
    .select(ASSIGNMENT_RELEASE_EVENT_COLUMNS.join(", "))
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    throw new Error(`Failed to load Birth Giving event ${eventId}: ${eventError.message}`);
  }

  const event = (rawEvent ?? null) as unknown as AssignmentReleaseEvent | null;
  if (!event) return 0;
  if (event.status !== "published" || event.removed_at !== null) return 0;
  if (event.assignment_state !== "present" || !event.assignment_uploaded_at || !event.assignment_storage_path) {
    return 0;
  }
  if (Date.parse(event.starts_at) > Date.now()) return 0;

  const { data: members, error: membersError } = await admin
    .from("birth_giving_team_members")
    .select(
      // `birth_giving_team_members` has three FKs to `profiles`
      // (profile_id, created_by_profile_id, updated_by_profile_id), so the
      // embed must name the FK hint or PostgREST rejects it as ambiguous
      // (PGRST201) and `members` comes back null — a silent zero-send.
      "profile:profiles!birth_giving_team_members_profile_id_fkey!inner(access_removed_at,beta_access_granted_at,beta_cohort,user:users!inner(verified_work_email))",
    )
    .eq("event_id", eventId);

  if (membersError) {
    throw new Error(`Failed to load Birth Giving members for event ${eventId}: ${membersError.message}`);
  }

  const baseUrl = process.env.APP_URL ?? process.env.SITE_URL ?? FALLBACK_APP_URL;
  const eventUrl = `${baseUrl}/birth-giving/${eventId}`;
  const emailContent = assignmentReleaseEmail({
    eventName: event.name,
    customer: event.customer,
    eventUrl,
  });

  let sent = 0;
  for (const m of (members ?? []) as unknown as AssignmentReleaseMember[]) {
    const profile = m.profile;
    // The admin client bypasses RLS, so skip members whose profile is no
    // longer active by the app's definition. Birth Giving is B-only, so only
    // B cohort receives assignment emails.
    if (
      !profile ||
      profile.access_removed_at !== null ||
      profile.beta_access_granted_at === null ||
      (profile as { beta_cohort?: string | null }).beta_cohort !== "B"
    )
      continue;
    const email = profile.user?.verified_work_email;
    if (!email) continue;
    try {
      await sendEmail(
        {
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
        },
        {
          idempotencyKey: `${ASSIGNMENT_EMAIL_KEY_PREFIX}-${eventId}-${event.assignment_storage_path}-${email}`,
        },
      );
      sent += 1;
    } catch (err) {
      serverLogger.console.error(`Failed to send assignment email to ${email}:`, err);
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

  const { data: rawEvents, error: listError } = await admin
    .from("birth_giving_events")
    .select("id")
    .eq("status", "published")
    .is("removed_at", null)
    .eq("assignment_state", "present")
    .lte("starts_at", now);

  if (listError) {
    throw new Error(`Failed to enumerate Birth Giving events: ${listError.message}`);
  }

  const events = (rawEvents ?? []) as Array<{ id: string }>;

  let sent = 0;
  for (const event of events) {
    sent += await notifyParticipantsOfAssignment(event.id);
  }

  return { sent };
}
