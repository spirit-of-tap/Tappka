import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  RocketCategoryWithItems,
  RocketHistoryEntry,
  RocketIndividualState,
  RocketTeamCheck,
} from "@/lib/rocket-model/types";
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types";
import { RocketModelView } from "./rocket-model-view";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children:
        | React.ReactNode
        | ((props: { width: number; height: number }) => React.ReactNode);
    }) => {
      const content =
        typeof children === "function"
          ? children({ width: 500, height: 500 })
          : children;
      return (
        <div style={{ width: 500, height: 500 }}>
          {React.isValidElement(content)
            ? React.cloneElement(
                content as React.ReactElement<{
                  width?: number;
                  height?: number;
                }>,
                { width: 500, height: 500 },
              )
            : content}
        </div>
      );
    },
  };
});

const ME = "profile-me";
const OTHER = "profile-other";

const members: TeamMemberProfile[] = [
  { id: ME, name: "Já", picture: null, role: "student" },
  { id: OTHER, name: "Kolega", picture: null, role: "student" },
];

function makeCategories(): RocketCategoryWithItems[] {
  return [
    {
      id: "cat-y1",
      code: "Y1",
      title: "Y1 - The process of Individual Learning",
      order_index: 0,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      items: [
        {
          id: "item-1",
          category_id: "cat-y1",
          order_index: 0,
          text_cs: "Každý člen týmu si vede Learning Diary.",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "item-2",
          category_id: "cat-y1",
          order_index: 1,
          text_cs: "Každý člen týmu má svůj Reading Plan.",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
  ];
}

function makeState(itemId: string, profileId: string): RocketIndividualState {
  return {
    item_id: itemId,
    profile_id: profileId,
    is_checked: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeTeamCheck(itemId: string): RocketTeamCheck {
  return {
    team_id: "team-1",
    item_id: itemId,
    is_checked: true,
    checked_by_profile_id: ME,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function renderView(overrides?: {
  states?: RocketIndividualState[];
  teamChecks?: RocketTeamCheck[];
  history?: RocketHistoryEntry[];
}) {
  const onToggleIndividual = vi.fn(async (_itemId: string, _checked: boolean) => {});
  const onToggleTeam = vi.fn(async (_itemId: string, _checked: boolean) => {});
  const result = render(
    <RocketModelView
      categories={makeCategories()}
      teamMembers={members}
      states={overrides?.states ?? [makeState("item-1", ME)]}
      teamChecks={overrides?.teamChecks ?? []}
      history={overrides?.history ?? []}
      profileId={ME}
      onToggleIndividual={onToggleIndividual}
      onToggleTeam={onToggleTeam}
    />,
  );
  return { ...result, onToggleIndividual, onToggleTeam };
}

describe("RocketModelView — Moje hodnocení", () => {
  it("renders without the snowflake visualization", () => {
    renderView();

    expect(
      screen.queryByRole("button", { name: /Hvězda pokroku/ }),
    ).not.toBeInTheDocument();
  });

  it("renders categories flat from DB without hardcoded dimension headers", () => {
    renderView();

    // Category itself renders
    expect(screen.getByText("Y1 - The process of Individual Learning")).toBeVisible();
    // Hardcoded dimension titles must not appear — categories come from DB
    expect(screen.queryByText("Učení")).not.toBeInTheDocument();
    expect(screen.queryByText("Vedení")).not.toBeInTheDocument();
    expect(screen.queryByText("Inovace")).not.toBeInTheDocument();
    expect(screen.queryByText("Zákazníci a značka")).not.toBeInTheDocument();
    expect(screen.queryByText("Zázemí")).not.toBeInTheDocument();
    expect(screen.queryByText("Další procesy")).not.toBeInTheDocument();
  });

  it("renders categories with items and own progress", () => {
    renderView();

    expect(screen.getByText("Y1 - The process of Individual Learning")).toBeVisible();
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();
    expect(screen.getByText("Každý člen týmu má svůj Reading Plan.")).toBeVisible();
    expect(screen.getAllByText("1 z 2")[0]).toBeVisible();

    // Verify progress bar shows 50% for 1 of 2
    const progressBars = screen.getAllByRole("progressbar");
    const categoryBar = progressBars[1]; // 0 is Celkem, 1 is category
    expect(categoryBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("displays success styling on category progress when all items are complete", () => {
    const { container } = renderView({
      states: [makeState("item-1", ME), makeState("item-2", ME)],
    });

    expect(screen.getByText("Splněno")).toBeVisible();
    expect(screen.getByText("2 z 2")).toBeVisible();

    const indicators = container.querySelectorAll("[data-slot='progress-indicator']");
    // Both overall and category indicators should have bg-success
    indicators.forEach((indicator) => {
      expect(indicator.className).toContain("bg-success");
    });
  });


  it("marks own checked items and calls back on toggle", async () => {
    const user = userEvent.setup();
    const { onToggleIndividual } = renderView();

    const checked = screen.getByRole("checkbox", {
      name: "Každý člen týmu si vede Learning Diary.",
    });
    expect(checked).toBeChecked();

    const unchecked = screen.getByRole("checkbox", {
      name: "Každý člen týmu má svůj Reading Plan.",
    });
    expect(unchecked).not.toBeChecked();
    await user.click(unchecked);
    expect(onToggleIndividual).toHaveBeenCalledWith("item-2", true);
  });

  it("filters items to only incomplete when requested", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Moje hodnocení/ }));
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /K doplnění/ }));

    expect(screen.queryByText("Každý člen týmu si vede Learning Diary.")).not.toBeInTheDocument();
    expect(screen.getByText("Každý člen týmu má svůj Reading Plan.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^Vše/ }));
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();
  });

  it("collapses and expands category cards", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Moje hodnocení/ }));
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Sbalit Y1/ }));
    expect(screen.queryByText("Každý člen týmu si vede Learning Diary.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Rozbalit Y1/ }));
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();

    // Clicking the title itself also collapses
    await user.click(screen.getByRole("heading", { name: /Y1 - The process/ }));
    expect(screen.queryByText("Každý člen týmu si vede Learning Diary.")).not.toBeInTheDocument();
  });

  it("orders items by team completion when 'Podle vyplnění' is selected", async () => {
    const user = userEvent.setup();
    // item-2 has 2 checkers (unanimous), item-1 has 0 checkers
    const { onToggleIndividual } = renderView({
      states: [makeState("item-2", ME), makeState("item-2", OTHER)],
    });

    await user.click(screen.getByRole("tab", { name: /Moje hodnocení/ }));
    await user.click(screen.getByRole("button", { name: /Podle vyplnění/ }));

    // Both items should be visible
    const item1 = screen.getByRole("group", {
      name: "Každý člen týmu si vede Learning Diary.",
    });
    const item2 = screen.getByRole("group", {
      name: "Každý člen týmu má svůj Reading Plan.",
    });

    expect(within(item2).getByText("2/2")).toBeVisible();
    expect(within(item1).getByText("0/2")).toBeVisible();

    // Verify item-2 (2 checkers) appears before item-1 (0 checkers)
    const allGroups = screen.getAllByRole("group");
    const index2 = allGroups.indexOf(item2);
    const index1 = allGroups.indexOf(item1);
    expect(index2).toBeLessThan(index1);

    // Can toggle item from the ranked list
    const uncheckedBox = within(item1).getByRole("checkbox");
    expect(uncheckedBox).not.toBeChecked();
    await user.click(uncheckedBox);
    expect(onToggleIndividual).toHaveBeenCalledWith("item-1", true);
  });

  it("allows filtering to only incomplete items within 'Podle vyplnění'", async () => {
    const user = userEvent.setup();
    // item-2 is completed by ME, item-1 is not
    renderView({
      states: [makeState("item-2", ME), makeState("item-1", OTHER)],
    });

    await user.click(screen.getByRole("tab", { name: /Moje hodnocení/ }));
    await user.click(screen.getByRole("button", { name: /Podle vyplnění/ }));

    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();
    expect(screen.getByText("Každý člen týmu má svůj Reading Plan.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Pouze k doplnění/ }));

    // Item-2 (already checked by ME) should be hidden
    expect(
      screen.queryByText("Každý člen týmu má svůj Reading Plan."),
    ).not.toBeInTheDocument();
    // Item-1 (not checked by ME) should remain visible
    expect(screen.getByText("Každý člen týmu si vede Learning Diary.")).toBeVisible();

    // Toggle back to all
    await user.click(screen.getByRole("button", { name: /Zobrazit vše/ }));
    expect(screen.getByText("Každý člen týmu má svůj Reading Plan.")).toBeVisible();
  });
});

describe("RocketModelView — Týmový přehled", () => {
  it("shows coverage and keeps the team check locked until unanimity", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));

    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });
    expect(within(teamSection).getByText("1/2")).toBeVisible();

    const teamCheck = within(teamSection).getByRole("checkbox", {
      name: /Každý člen týmu si vede Learning Diary\./,
    });
    expect(teamCheck).toBeDisabled();
    expect(
      within(teamSection).getByText(/Odemkne se, až položku splní celý tým/),
    ).toBeVisible();
  });

  it("shows team progress summary hero card and missing members indicator", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });

    expect(within(teamSection).getByText("Týmový postup")).toBeVisible();
    expect(within(teamSection).getByText(/Potvrzeno týmem: 0 z 2 položek/)).toBeVisible();
    expect(within(teamSection).getByText("Chybí: Kolega")).toBeVisible();
  });

  it("renders avatar chips for all team members reflecting checked and unchecked status", async () => {
    const user = userEvent.setup();
    renderView({
      states: [makeState("item-1", ME)],
    });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });
    const firstItem = within(teamSection).getByRole("group", {
      name: "Každý člen týmu si vede Learning Diary.",
    });

    expect(within(firstItem).getByLabelText("Já: Splněno")).toBeVisible();
    expect(within(firstItem).getByLabelText("Kolega: Nesplněno")).toBeVisible();
  });

  it("unlocks the team check on unanimity and records the confirmation", async () => {
    const user = userEvent.setup();
    const { onToggleTeam } = renderView({
      states: [makeState("item-1", ME), makeState("item-1", OTHER)],
    });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });

    expect(within(teamSection).getByText("2/2")).toBeVisible();
    expect(within(teamSection).getByText("Celý tým splnil")).toBeVisible();

    const teamCheck = within(teamSection).getByRole("checkbox", {
      name: /Každý člen týmu si vede Learning Diary\./,
    });
    expect(teamCheck).toBeEnabled();

    await user.click(teamCheck);
    expect(onToggleTeam).toHaveBeenCalledWith("item-1", true);
  });

  it("flags a team check that lost unanimity for reconfirmation", async () => {
    const user = userEvent.setup();
    renderView({ teamChecks: [makeTeamCheck("item-1")] });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });

    const itemGroup = within(teamSection).getByRole("group", {
      name: "Každý člen týmu si vede Learning Diary.",
    });
    expect(within(itemGroup).getByText("K novému potvrzení")).toBeVisible();
  });

  it("filters items in team overview by ready to confirm", async () => {
    const user = userEvent.setup();
    renderView({
      states: [makeState("item-1", ME), makeState("item-1", OTHER)],
    });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });

    // Item 1 is ready, Item 2 is not
    await user.click(within(teamSection).getByRole("button", { name: /K potvrzení \(1\)/ }));

    expect(
      within(teamSection).getByText("Každý člen týmu si vede Learning Diary."),
    ).toBeVisible();
    expect(
      within(teamSection).queryByText("Každý člen týmu má svůj Reading Plan."),
    ).not.toBeInTheDocument();
  });

  it("shows who checked an item and when", async () => {
    const user = userEvent.setup();
    renderView({
      states: [
        { ...makeState("item-1", ME), updated_at: "2026-09-10T08:05:00Z" },
        { ...makeState("item-1", OTHER), updated_at: "2026-09-11T09:00:00Z" },
      ],
    });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });
    const firstItem = within(teamSection).getByRole("group", {
      name: "Každý člen týmu si vede Learning Diary.",
    });
    const secondItem = within(teamSection).getByRole("group", {
      name: "Každý člen týmu má svůj Reading Plan.",
    });

    await user.click(within(firstItem).getByRole("button", { name: /Kdo a kdy/ }));
    expect(within(firstItem).getByText("Já")).toBeVisible();
    expect(within(firstItem).getByText("Kolega")).toBeVisible();
    expect(
      within(firstItem).getAllByText(/\d{1,2}\. \d{1,2}\. \d{4} \d{1,2}:\d{2}/),
    ).toHaveLength(2);

    await user.click(within(secondItem).getByRole("button", { name: /Kdo a kdy/ }));
    expect(within(secondItem).getAllByText("Nesplněno")).toHaveLength(2);
  });

  it("expands own change history", async () => {
    const user = userEvent.setup();
    renderView({
      history: [
        {
          id: "hist-1",
          itemId: "item-1",
          isChecked: true,
          createdAt: "2026-09-01T10:00:00Z",
          itemText: "Každý člen týmu si vede Learning Diary.",
          categoryTitle: "Y1 - The process of Individual Learning",
        },
      ],
    });

    await user.click(screen.getByRole("tab", { name: /Moje hodnocení/ }));
    await user.click(screen.getByRole("button", { name: /Historie změn/ }));
    expect(screen.getByText("Splněno")).toBeVisible();
  });

  it("opens radar chart dialog from team overview and displays section stats", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });

    const radarButton = within(teamSection).getByRole("button", {
      name: /Radarový graf/,
    });
    expect(radarButton).toBeVisible();

    await user.click(radarButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText("Radarový graf sekcí")).toBeVisible();
    expect(within(dialog).getByText("Živá synchronizace")).toBeVisible();
    expect(within(dialog).getAllByText("Y1")[0]).toBeVisible();
    expect(within(dialog).getByText(/Potvrzeno:/)).toBeVisible();
    expect(within(dialog).getByText(/Průměr:/)).toBeVisible();
  });

  it("updates radar chart visualization in real time when props change while dialog is open", async () => {
    const user = userEvent.setup();
    const initial = renderView({
      states: [makeState("item-1", ME)],
      teamChecks: [],
    });

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });
    await user.click(within(teamSection).getByRole("button", { name: /Radarový graf/ }));

    const dialog = screen.getByRole("dialog");
    // Initially 0% confirmed
    expect(within(dialog).getAllByText(/0 %/)[0]).toBeVisible();
    expect(within(dialog).getByText(/\(0\/2\)/)).toBeVisible();

    // Teammate confirms item-1 in real time -> props to RocketModelView update
    initial.rerender(
      <RocketModelView
        categories={makeCategories()}
        teamMembers={members}
        states={[makeState("item-1", ME), makeState("item-1", OTHER)]}
        teamChecks={[makeTeamCheck("item-1")]}
        history={[]}
        profileId={ME}
        onToggleIndividual={initial.onToggleIndividual}
        onToggleTeam={initial.onToggleTeam}
      />,
    );

    // Dialog remains open and reflects the realtime update
    expect(within(dialog).getAllByText(/50 %/)[0]).toBeVisible();
    expect(within(dialog).getByText(/\(1\/2\)/)).toBeVisible();
  });

  it("navigates to section and closes dialog when section in breakdown is clicked", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("tab", { name: /Týmový přehled/ }));
    const teamSection = screen.getByRole("tabpanel", { name: /Týmový přehled/ });
    await user.click(within(teamSection).getByRole("button", { name: /Radarový graf/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();

    const categoryButton = within(dialog).getByRole("button", { name: /Y1/ });
    await user.click(categoryButton);

    // Dialog closes
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
