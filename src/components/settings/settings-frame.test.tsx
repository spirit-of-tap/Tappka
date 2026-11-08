import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SETTINGS_ROUTES, type SettingsSection } from "@/lib/settings/sections"

import { SettingsFrame } from "./settings-frame"

const pathnameRef = { current: SETTINGS_ROUTES.root as string }
vi.mock("next/navigation", () => ({ usePathname: () => pathnameRef.current }))

const SECTIONS: SettingsSection[] = [
  { id: "notifikace", title: "Notifikace", description: "E-maily", href: SETTINGS_ROUTES.notifikace },
  { id: "mistnosti", title: "Místnosti", description: "Rozvrh TS", href: SETTINGS_ROUTES.mistnosti },
]

describe("SettingsFrame", () => {
  it("lists the sections it is given and nothing else", () => {
    render(<SettingsFrame sections={SECTIONS}>obsah</SettingsFrame>)
    const nav = screen.getByRole("navigation", { name: "Nastavení" })
    expect(nav).toHaveTextContent("Notifikace")
    expect(nav).toHaveTextContent("Místnosti")
    expect(nav).not.toHaveTextContent("Tagy v Čase")
  })

  it("marks the active section and offers a way back to the list", () => {
    pathnameRef.current = SETTINGS_ROUTES.mistnosti
    render(<SettingsFrame sections={SECTIONS}>obsah</SettingsFrame>)
    expect(screen.getByRole("link", { name: /Místnosti/ })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: /Notifikace/ })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "Zpět na nastavení" })).toHaveAttribute("href", SETTINGS_ROUTES.root)
  })

  it("has no back link on the hub itself", () => {
    pathnameRef.current = SETTINGS_ROUTES.root
    render(<SettingsFrame sections={SECTIONS}>obsah</SettingsFrame>)
    expect(screen.queryByRole("link", { name: "Zpět na nastavení" })).not.toBeInTheDocument()
  })
})
