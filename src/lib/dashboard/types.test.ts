import { describe, expect, it } from "vitest";
import {
  widgetsForRole,
  sanitizeWidgetIds,
  resolveDashboardWidgets,
  availableWidgets,
  DASHBOARD_WIDGETS,
} from "@/lib/dashboard/types";

describe("widgetsForRole", () => {
  it("returns reading and team-snapshot widgets for student", () => {
    const widgets = widgetsForRole("student");
    const ids = widgets.map((w) => w.id);
    expect(ids).toContain("reading");
    expect(ids).toContain("team-snapshot");
    expect(ids).not.toContain("ke-kontrole");
  });

  it("offers the next training session widget to every role", () => {
    for (const role of ["student", "mentor", "coach", "admin"] as const) {
      expect(widgetsForRole(role).map((w) => w.id)).toContain("next-session");
    }
  });

  it("returns ke-kontrole widget for coach", () => {
    const widgets = widgetsForRole("coach");
    const ids = widgets.map((w) => w.id);
    expect(ids).toContain("ke-kontrole");
    expect(ids).not.toContain("reading");
  });

  it("returns admin widgets for admin", () => {
    const widgets = widgetsForRole("admin");
    const ids = widgets.map((w) => w.id);
    expect(ids).toContain("ke-kontrole");
    expect(ids).toContain("team-snapshot");
    expect(ids).not.toContain("reading");
  });
});

describe("sanitizeWidgetIds", () => {
  it("returns empty array for non-array input", () => {
    expect(sanitizeWidgetIds(null, "student")).toEqual([]);
    expect(sanitizeWidgetIds("foo", "student")).toEqual([]);
    expect(sanitizeWidgetIds(123, "student")).toEqual([]);
    expect(sanitizeWidgetIds(undefined, "student")).toEqual([]);
  });

  it("filters out unknown widgets", () => {
    const result = sanitizeWidgetIds(["reading", "nonexistent", "team-snapshot"], "student");
    expect(result).toEqual(["reading", "team-snapshot"]);
  });

  it("filters out widgets not allowed for the role", () => {
    const result = sanitizeWidgetIds(["reading", "ke-kontrole"], "student");
    expect(result).toEqual(["reading"]);
  });

  it("deduplicates repeated ids", () => {
    const result = sanitizeWidgetIds(["reading", "reading", "team-snapshot", "reading"], "student");
    expect(result).toEqual(["reading", "team-snapshot"]);
  });

  it("preserves order of first occurrence", () => {
    const result = sanitizeWidgetIds(["team-snapshot", "reading"], "student");
    expect(result).toEqual(["team-snapshot", "reading"]);
  });
});

describe("availableWidgets", () => {
  it("excludes the metrics catalog entry when beta access is missing", () => {
    const ids = availableWidgets(DASHBOARD_WIDGETS, false).map((w) => w.id);
    expect(ids).not.toContain("metrics");
  });

  it("includes the metrics catalog entry when beta access is present", () => {
    const ids = availableWidgets(DASHBOARD_WIDGETS, true).map((w) => w.id);
    expect(ids).toContain("metrics");
  });
});

describe("resolveDashboardWidgets", () => {
  it("shows everything the role can see when nothing is saved", () => {
    expect(resolveDashboardWidgets(null, "student", true)).toEqual(
      widgetsForRole("student").map((w) => w.id),
    );
    expect(resolveDashboardWidgets([], "coach", true)).toEqual(
      widgetsForRole("coach").map((w) => w.id),
    );
  });

  it("keeps a saved choice but always in canonical order", () => {
    expect(resolveDashboardWidgets(["team-snapshot", "quick-actions"], "student", true)).toEqual([
      "quick-actions",
      "team-snapshot",
    ]);
  });

  it("drops metrics without beta access, also from the default", () => {
    expect(resolveDashboardWidgets(null, "student", false)).not.toContain("metrics");
    expect(resolveDashboardWidgets(["metrics", "reading"], "student", false)).toEqual(["reading"]);
  });
});
