import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { TeamActivityImage } from "./team-activity-image"
import { TeamActivityThumb } from "./team-activity-thumb"

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")

const IMAGE_PATH = "team-activities/team-1/photo.webp"

describe("TeamActivityImage", () => {
  it("renders separate mobile and desktop card crops from Supabase transformations", () => {
    const { container } = render(<TeamActivityImage imagePath={IMAGE_PATH} variant="card" />)

    const image = screen.getByRole("presentation")
    expect(image).toHaveAttribute("width", "960")
    expect(image).toHaveAttribute("height", "640")
    expect(image.getAttribute("srcset")).toContain("width=480&height=320")
    expect(image.getAttribute("srcset")).toContain("1280w")
    expect(image.getAttribute("src")).toContain("/storage/v1/render/image/public/images/")

    const desktopSource = container.querySelector("source[media='(min-width: 640px)']")
    expect(desktopSource).toHaveAttribute("sizes", "960px")
    expect(desktopSource?.getAttribute("srcset")).toContain("width=960&height=360")
    expect(desktopSource?.getAttribute("srcset")).toContain("1600w")
  })

  it("loads the detail hero eagerly at high priority", () => {
    render(<TeamActivityImage imagePath={IMAGE_PATH} variant="hero" />)

    const image = screen.getByRole("presentation")
    expect(image).toHaveAttribute("loading", "eager")
    expect(image).toHaveAttribute("fetchpriority", "high")
    expect(image).toHaveAttribute("width", "1600")
    expect(image).toHaveAttribute("height", "900")
    expect(image.getAttribute("srcset")).toContain("width=1200&height=675")
  })

  it("can prioritize the first timeline photo without involving Vercel Image", () => {
    render(<TeamActivityImage imagePath={IMAGE_PATH} variant="card" priority />)

    const image = screen.getByRole("presentation")
    expect(image).toHaveAttribute("loading", "eager")
    expect(image).toHaveAttribute("fetchpriority", "high")
  })
})

describe("TeamActivityThumb", () => {
  it("keeps photo thumbnails square at the requested display size", () => {
    render(<TeamActivityThumb imagePath={IMAGE_PATH} activityType="Výlet" size={48} />)

    const image = screen.getByRole("presentation")
    expect(image).toHaveStyle({ width: "48px", height: "48px" })
    expect(image.getAttribute("src")).toContain("width=192")
    expect(image.getAttribute("src")).toContain("height=192")
  })
})
