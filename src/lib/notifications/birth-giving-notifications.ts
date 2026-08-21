import { createAdminClient } from "@/lib/supabase/admin";

import { sendEmail } from "./send-email";

const START_BATCH_SIZE = 25;
const DELIVERY_BATCH_SIZE = 25;
const DELIVERY_IDEMPOTENCY_PREFIX = "birth-giving-delivery-";
const EVENT_PATH_PREFIX = "/birth-giving/";

interface BirthGivingEmailContext {
  eventName: string;
  customer: string;
  eventUrl: string;
}

interface EmailContent {
  subject: string;
  html: string;
}

interface ClaimedDelivery {
  delivery_id: string;
  processing_token: string;
  recipient_email: string;
  message_type: "assignment_release" | "assignment_replacement";
  replacement_id: string | null;
  event_id: string;
  event_name: string;
  customer: string;
  email_subject: string | null;
  email_html: string | null;
}

export interface BirthGivingNotificationResult {
  startsProcessed: number;
  claimed: number;
  sent: number;
  failed: number;
  persistenceErrors: number;
  manualReview: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function assignmentEmail(ctx: BirthGivingEmailContext, replacement: boolean): EmailContent {
  const title = replacement ? "Nová verze zadání" : "Zadání je dostupné";
  const introduction = replacement
    ? "K dispozici je nová verze zadání. Před zahájením práce si prosím otevřete aktuální soubor."
    : "Zadání je nyní dostupné. Otevřete si detail akce a můžete začít.";
  return {
    subject: `${title}: ${ctx.eventName}`,
    html: `<!doctype html>
<html lang="cs"><body>
  <h1>${title}</h1>
  <p>${introduction}</p>
  <p><strong>${escapeHtml(ctx.eventName)}</strong><br>${escapeHtml(ctx.customer)}</p>
  <p><a href="${escapeHtml(ctx.eventUrl)}">Otevřít zadání</a></p>
</body></html>`,
  };
}

export function assignmentReleaseEmail(ctx: BirthGivingEmailContext): EmailContent {
  return assignmentEmail(ctx, false);
}

export function assignmentReplacementEmail(ctx: BirthGivingEmailContext): EmailContent {
  return assignmentEmail(ctx, true);
}

export function birthGivingDeliveryIdempotencyKey(deliveryId: string): string {
  return `${DELIVERY_IDEMPOTENCY_PREFIX}${deliveryId}`;
}

function canonicalEventUrl(eventId: string): string {
  const configuredUrl = process.env.APP_URL ?? process.env.SITE_URL;
  if (!configuredUrl) throw new Error("APP_URL or SITE_URL is not configured");

  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("APP_URL or SITE_URL must use HTTP or HTTPS");
  }
  return new URL(`${EVENT_PATH_PREFIX}${encodeURIComponent(eventId)}`, appUrl.origin).toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processBirthGivingNotifications(): Promise<BirthGivingNotificationResult> {
  const admin = createAdminClient();
  const startResult = await admin.rpc("birth_giving_process_due_starts", { p_limit: START_BATCH_SIZE });
  if (startResult.error) throw new Error(`Failed to process Birth Giving starts: ${startResult.error.message}`);
  const reconciliation = await admin.rpc("birth_giving_reconcile_email_deliveries");
  if (reconciliation.error) {
    throw new Error(`Failed to reconcile Birth Giving deliveries: ${reconciliation.error.message}`);
  }

  const claimResult = await admin.rpc("birth_giving_claim_email_deliveries", { p_limit: DELIVERY_BATCH_SIZE });
  if (claimResult.error) throw new Error(`Failed to claim Birth Giving deliveries: ${claimResult.error.message}`);
  const claims = (claimResult.data ?? []) as ClaimedDelivery[];
  let sent = 0;
  let failed = 0;
  let persistenceErrors = 0;

  for (const claim of claims) {
    let providerMessageId: string;
    try {
      let content: EmailContent;
      if (claim.email_subject !== null && claim.email_html !== null) {
        content = { subject: claim.email_subject, html: claim.email_html };
      } else {
        const context = {
          eventName: claim.event_name,
          customer: claim.customer,
          eventUrl: canonicalEventUrl(claim.event_id),
        };
        const generated = claim.message_type === "assignment_replacement"
          ? assignmentReplacementEmail(context)
          : assignmentReleaseEmail(context);
        const preparation = await admin.rpc("birth_giving_prepare_email_delivery", {
          p_delivery_id: claim.delivery_id,
          p_processing_token: claim.processing_token,
          p_email_subject: generated.subject,
          p_email_html: generated.html,
        });
        if (preparation.error || !preparation.data?.[0]) {
          throw new Error(preparation.error?.message ?? "Delivery processing lease is no longer current");
        }
        content = { subject: preparation.data[0].email_subject, html: preparation.data[0].email_html };
      }
      const provider = await sendEmail(
        { to: claim.recipient_email, ...content },
        { idempotencyKey: birthGivingDeliveryIdempotencyKey(claim.delivery_id) },
      );
      providerMessageId = provider.id;
    } catch (error) {
      const failure = await admin.rpc("birth_giving_fail_email_delivery", {
        p_delivery_id: claim.delivery_id,
        p_processing_token: claim.processing_token,
        p_error: errorMessage(error),
      });
      if (failure.error || !failure.data) {
        persistenceErrors += 1;
      } else {
        failed += 1;
      }
      continue;
    }

    const completion = await admin.rpc("birth_giving_complete_email_delivery", {
      p_delivery_id: claim.delivery_id,
      p_processing_token: claim.processing_token,
      p_provider_message_id: providerMessageId,
    });
    if (completion.error || !completion.data) {
      persistenceErrors += 1;
      continue;
    }
    sent += 1;
  }

  return {
    startsProcessed: startResult.data ?? 0,
    claimed: claims.length,
    sent,
    failed,
    persistenceErrors,
    manualReview: reconciliation.data ?? 0,
  };
}

export async function processBirthGiving() {
  return processBirthGivingNotifications();
}
