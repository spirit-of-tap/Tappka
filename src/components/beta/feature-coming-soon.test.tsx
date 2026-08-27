import { render, screen } from "@testing-library/react"
import { FeatureComingSoon } from "./feature-coming-soon"

it("renders feature name, no actions, and hidden animation", () => {
  render(<FeatureComingSoon featureName="Čtení" />)
  expect(screen.getByRole("heading", { name: /V kuchyni se něco chystá/i })).toBeInTheDocument()
  expect(screen.getByText(/Funkce.*Čtení.*probublává/)).toBeInTheDocument()
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  const anim = document.querySelector("[data-testid='cooking-animation']")
  expect(anim).toHaveAttribute("aria-hidden", "true")
})
