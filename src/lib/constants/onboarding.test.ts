import { describe, expect, it } from "vitest";

import { ONBOARDING_TEXT } from "@/lib/constants/onboarding";

describe("ONBOARDING_TEXT", () => {
  it("addresses the user in the app's informal tykání through the pending step", () => {
    const { pendingStep } = ONBOARDING_TEXT;
    const copy = [
      pendingStep.mainText,
      pendingStep.emailLabel,
      pendingStep.timeEstimate,
      ...pendingStep.processList,
    ].join(" ");

    expect(copy).toContain("Tvůj účet nyní čeká na schválení.");
    expect(copy).toContain("Tvůj email:");
    expect(copy).toContain("Dostaneme oznámení o tvé registraci");
    expect(copy).toContain("Vytvoříme tvůj profil v systému");
    expect(copy).toContain("Budeš mít plný přístup do Tappky");
  });

  it("keeps the register flow free of generic vykání forms", () => {
    const { pendingStep } = ONBOARDING_TEXT;
    const copy = [
      pendingStep.mainText,
      pendingStep.emailLabel,
      pendingStep.timeEstimate,
      ...pendingStep.processList,
    ].join(" ");

    for (const form of ["Váš", "vaší", "Vaší", "obdržíte", "Budete"]) {
      expect(copy).not.toContain(form);
    }
  });
});