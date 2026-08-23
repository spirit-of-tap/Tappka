import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TeamReflectionCalendar } from "./team-reflection-calendar"

describe("TeamReflectionCalendar", () => {
  it("renders month names (Oct..May) in the timeline strip", () => {
    render(
      <TeamReflectionCalendar
        monthlyReflections={[]}
        rocnikovaReflections={[]}
        currentMonth="2026-05-01"
        onboardingYear={2025}
      />,
    )

    expect(screen.getByText("Říjen")).toBeInTheDocument()
    expect(screen.getByText("Listopad")).toBeInTheDocument()
    expect(screen.getByText("Prosinec")).toBeInTheDocument()
    expect(screen.getByText("Leden")).toBeInTheDocument()
    expect(screen.getByText("Únor")).toBeInTheDocument()
    expect(screen.getByText("Březen")).toBeInTheDocument()
    expect(screen.getByText("Duben")).toBeInTheDocument()
    expect(screen.getByText("Květen")).toBeInTheDocument()
  })

  it("renders dual actions for May (Měsíční and Ročníková)", () => {
    render(
      <TeamReflectionCalendar
        monthlyReflections={[]}
        rocnikovaReflections={[]}
        currentMonth="2026-05-01"
        onboardingYear={2025}
      />,
    )

    expect(screen.getByText("Měsíční")).toBeInTheDocument()
    expect(screen.getByText("Ročníková")).toBeInTheDocument()
  })

  it("lets user switch between 1., 2. and 3. ročník tabs", async () => {
    const user = userEvent.setup()

    render(
      <TeamReflectionCalendar
        monthlyReflections={[]}
        rocnikovaReflections={[]}
        currentMonth="2026-08-01"
        onboardingYear={1}
      />,
    )

    const tab2 = screen.getByRole("button", { name: /2\. ročník/i })
    await user.click(tab2)

    expect(screen.getByText(/2\. ročník \(2026\/2027\)/i)).toBeInTheDocument()
  })
})
