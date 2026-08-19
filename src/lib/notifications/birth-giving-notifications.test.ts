import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanupBirthGivingStorage: vi.fn(),
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/birth-giving/storage-cleanup", () => ({
  cleanupBirthGivingStorage: mocks.cleanupBirthGivingStorage,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./send-email", () => ({ sendEmail: mocks.sendEmail }));

import {
  assignmentReleaseEmail,
  assignmentReplacementEmail,
  birthGivingDeliveryIdempotencyKey,
  processBirthGiving,
  processBirthGivingNotifications,
} from "./birth-giving-notifications";

const claim = {
  delivery_id: "delivery-id",
  processing_token: "processing-token",
  recipient_email: "recipient@example.com",
  message_type: "assignment_release" as const,
  replacement_id: null,
  event_id: "event-id",
  event_name: "Akce <script>",
  customer: "Klient & partner",
  email_subject: null,
  email_html: null,
};

describe("Birth Giving email templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://canonical.example/base/";
    delete process.env.SITE_URL;
  });

  it("escapes dynamic release content and links to the canonical application URL", () => {
    const content = assignmentReleaseEmail({
      eventName: 'Akce <script> "x"',
      customer: "Klient & partner",
      eventUrl: "https://canonical.example/birth-giving/event-id",
    });

    expect(content.subject).toContain("Zadání je dostupné");
    expect(content.html).toContain("Akce &lt;script&gt; &quot;x&quot;");
    expect(content.html).toContain("Klient &amp; partner");
    expect(content.html).toContain('href="https://canonical.example/birth-giving/event-id"');
    expect(content.html).not.toContain("<script>");
    expect(content.html).not.toMatch(/není dostupné|chybí/i);
  });

  it("describes a replacement without assuming recipient identity", () => {
    const content = assignmentReplacementEmail({
      eventName: "Akce",
      customer: "Klient",
      eventUrl: "https://canonical.example/birth-giving/event-id",
    });

    expect(content.subject).toContain("Nová verze zadání");
    expect(content.html).toContain("K dispozici je nová verze zadání");
    expect(content.html).not.toMatch(/účastník|účastnice|student|studentka/i);
  });
});

describe("Birth Giving notification processing", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://canonical.example/base/";
    delete process.env.SITE_URL;
    rpc.mockReset();
    mocks.createAdminClient.mockReturnValue({ rpc });
    mocks.cleanupBirthGivingStorage.mockResolvedValue({ claimed: 0, deleted: 0, failed: 0 });
  });

  it("uses a deterministic provider idempotency key for each delivery", () => {
    expect(birthGivingDeliveryIdempotencyKey("550e8400-e29b-41d4-a716-446655440000"))
      .toBe("birth-giving-delivery-550e8400-e29b-41d4-a716-446655440000");
  });

  it("processes starts, sends claimed jobs, and completes with the matching fence token", async () => {
    rpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: [{ email_subject: "Stored subject", email_html: "<p>Stored HTML</p>" }], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.sendEmail.mockResolvedValue({ id: "resend-id" });

    await expect(processBirthGivingNotifications()).resolves.toEqual({
      startsProcessed: 2,
      claimed: 1,
      sent: 1,
      failed: 0,
      persistenceErrors: 0,
      manualReview: 0,
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "recipient@example.com" }),
      { idempotencyKey: "birth-giving-delivery-delivery-id" },
    );
    expect(rpc).toHaveBeenLastCalledWith("birth_giving_complete_email_delivery", {
      p_delivery_id: "delivery-id",
      p_processing_token: "processing-token",
      p_provider_message_id: "resend-id",
    });
  });

  it("durably fails a claimed job when canonical URL configuration is missing", async () => {
    delete process.env.APP_URL;
    delete process.env.SITE_URL;
    rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(processBirthGivingNotifications()).resolves.toEqual({
      startsProcessed: 0,
      claimed: 1,
      sent: 0,
      failed: 1,
      persistenceErrors: 0,
      manualReview: 0,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("birth_giving_fail_email_delivery", expect.objectContaining({
      p_delivery_id: "delivery-id",
      p_processing_token: "processing-token",
      p_error: expect.stringContaining("APP_URL or SITE_URL"),
    }));
  });

  it("counts a completion persistence error and continues with remaining claims", async () => {
    const secondClaim = { ...claim, delivery_id: "delivery-id-2", processing_token: "processing-token-2" };
    rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: [claim, secondClaim], error: null })
      .mockResolvedValueOnce({ data: [{ email_subject: "subject-1", email_html: "html-1" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } })
      .mockResolvedValueOnce({ data: [{ email_subject: "subject-2", email_html: "html-2" }], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.sendEmail
      .mockResolvedValueOnce({ id: "possibly-accepted" })
      .mockResolvedValueOnce({ id: "accepted" });

    await expect(processBirthGivingNotifications()).resolves.toEqual({
      startsProcessed: 0,
      claimed: 2,
      sent: 1,
      failed: 0,
      persistenceErrors: 1,
      manualReview: 1,
    });
    expect(rpc).not.toHaveBeenCalledWith("birth_giving_fail_email_delivery", expect.anything());
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("counts a failure persistence error and continues with remaining claims", async () => {
    const secondClaim = { ...claim, delivery_id: "delivery-id-2", processing_token: "processing-token-2" };
    rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: [claim, secondClaim], error: null })
      .mockResolvedValueOnce({ data: [{ email_subject: "subject-1", email_html: "html-1" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } })
      .mockResolvedValueOnce({ data: [{ email_subject: "subject-2", email_html: "html-2" }], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.sendEmail
      .mockRejectedValueOnce(new Error("ambiguous provider failure"))
      .mockResolvedValueOnce({ id: "accepted" });

    await expect(processBirthGivingNotifications()).resolves.toEqual({
      startsProcessed: 0,
      claimed: 2,
      sent: 1,
      failed: 0,
      persistenceErrors: 1,
      manualReview: 0,
    });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("reuses a persisted payload when event data and APP_URL change between retries", async () => {
    const subject = "Persisted subject";
    const html = '<a href="https://original.example/birth-giving/event-id">Persisted body</a>';
    process.env.APP_URL = "https://changed.example";
    rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({
        data: [{ ...claim, event_name: "Changed event", email_subject: subject, email_html: html }],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.sendEmail.mockResolvedValue({ id: "accepted" });

    await processBirthGivingNotifications();

    expect(rpc).not.toHaveBeenCalledWith("birth_giving_prepare_email_delivery", expect.anything());
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      { to: claim.recipient_email, subject, html },
      { idempotencyKey: "birth-giving-delivery-delivery-id" },
    );
  });

  it("processes notifications without scanning storage cleanup", async () => {
    rpc
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: 0, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(processBirthGiving()).resolves.toEqual({
      startsProcessed: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      persistenceErrors: 0,
      manualReview: 0,
    });
    expect(mocks.cleanupBirthGivingStorage).not.toHaveBeenCalled();
  });
});
