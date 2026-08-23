import { describe, it, expect } from "vitest";
import { isPublicRoute, isValidWorkEmailDomain } from "./auth";

describe("auth constants & helpers", () => {
  describe("isPublicRoute", () => {
    it("recognizes /auth routes as public", () => {
      expect(isPublicRoute("/auth/login")).toBe(true);
      expect(isPublicRoute("/auth/onboarding")).toBe(true);
      expect(isPublicRoute("/auth/error")).toBe(true);
    });

    it("recognizes /about route as public", () => {
      expect(isPublicRoute("/about")).toBe(true);
      expect(isPublicRoute("/about/details")).toBe(true);
    });

    it("rejects protected routes", () => {
      expect(isPublicRoute("/")).toBe(false);
      expect(isPublicRoute("/cteni")).toBe(false);
      expect(isPublicRoute("/birth-giving")).toBe(false);
      expect(isPublicRoute("/komunita")).toBe(false);
      expect(isPublicRoute("/reservations")).toBe(false);
    });
  });

  describe("isValidWorkEmailDomain", () => {
    it("accepts valid CZU email domains", () => {
      expect(isValidWorkEmailDomain("student@studenti.czu.cz")).toBe(true);
      expect(isValidWorkEmailDomain("vyucujici@pef.czu.cz")).toBe(true);
      expect(isValidWorkEmailDomain("admin@rektorat.czu.cz")).toBe(true);
    });

    it("rejects invalid domains or invalid format", () => {
      expect(isValidWorkEmailDomain("user@gmail.com")).toBe(false);
      expect(isValidWorkEmailDomain("invalid-email")).toBe(false);
      expect(isValidWorkEmailDomain("")).toBe(false);
    });
  });
});
