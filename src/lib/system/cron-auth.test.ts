import { afterEach, describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "./cron-auth";

describe("isAuthorizedCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("fails closed when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCronRequest(new Request("http://localhost", {
      headers: { authorization: "Bearer undefined" },
    }))).toBe(false);
  });

  it("rejects a missing or incorrect bearer secret", () => {
    process.env.CRON_SECRET = "configured-secret";
    expect(isAuthorizedCronRequest(new Request("http://localhost"))).toBe(false);
    expect(isAuthorizedCronRequest(new Request("http://localhost", {
      headers: { authorization: "Bearer wrong-secret" },
    }))).toBe(false);
  });

  it("accepts the exact configured bearer secret", () => {
    process.env.CRON_SECRET = "configured-secret";
    expect(isAuthorizedCronRequest(new Request("http://localhost", {
      headers: { authorization: "Bearer configured-secret" },
    }))).toBe(true);
  });
});
