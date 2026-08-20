import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileHub } from "./profile-hub";

const { mockSignOut, mockPush } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockSetTheme } = vi.hoisted(() => ({ mockSetTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}));

const USER = {
  id: "profile-1",
  name: "Anna Nováková",
  email: "anna@example.com",
  role: "student" as const,
  beta_access: true,
};

beforeEach(() => {
  mockSignOut.mockReset();
  mockPush.mockReset();
  mockSetTheme.mockReset();
});

describe("ProfileHub", () => {
  it("renders user card and main rows", () => {
    render(<ProfileHub user={USER} />);
    expect(screen.getByText("Anna Nováková")).toBeInTheDocument();
    expect(screen.getByText("anna@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Můj profil/ })).toHaveAttribute("href", "/komunita/profil/profile-1");
    expect(screen.getByRole("link", { name: /Notifikace/ })).toHaveAttribute("href", "/settings/notifikace");
    expect(screen.getByRole("link", { name: /Zpětná vazba/ })).toHaveAttribute("href", "/zpetna-vazba");
    expect(screen.getByRole("link", { name: /Beta přístup/ })).toHaveAttribute("href", "/beta");
  });

  it("shows Portfolio row only for beta users", () => {
    render(<ProfileHub user={USER} />);
    expect(screen.getByRole("link", { name: /Portfolio/ })).toBeInTheDocument();
  });

  it("hides Portfolio row without beta access", () => {
    render(<ProfileHub user={{ ...USER, beta_access: false }} />);
    expect(screen.queryByRole("link", { name: /Portfolio/ })).not.toBeInTheDocument();
  });

  it("switches theme from the theme row", async () => {
    const user = userEvent.setup();
    render(<ProfileHub user={USER} />);
    await user.click(screen.getByRole("button", { name: "Tmavé" }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("signs out and redirects to login", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<ProfileHub user={USER} />);
    await user.click(screen.getByRole("button", { name: /Odhlásit se/ }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/auth/login"));
  });
});
