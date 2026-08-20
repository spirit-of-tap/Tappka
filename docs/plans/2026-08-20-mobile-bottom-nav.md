# Mobile Bottom Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give mobile (< `md`) a native-app-like experience: hide the sidebar/sheet entirely, add a bottom tab bar (Domů / Moduly / Profil) with two new hub pages (`/moduly`, `/profil`), and remove the floating feedback pill.

**Architecture:** Extract the module list from `app-sidebar.tsx` into a shared config (`src/lib/navigation.ts`) used by both the sidebar and the new `/moduly` hub. The shadcn `Sidebar` renders a mobile `Sheet` when `isMobile` — `AppSidebar` returns `null` on mobile to kill it. A new `MobileBottomNav` (fixed, `md:hidden`) provides the tab bar; `SidebarTrigger`, footer, and content padding adapt in `(main)/layout.tsx`.

**Tech Stack:** Next.js App Router, shadcn/ui (Tailwind v4), lucide-react, vitest + testing-library (component tests), `@` → `src` alias.

**Design doc:** `docs/plans/2026-08-20-mobile-bottom-nav-design.md` (validated).

**Conventions:** TypeScript strict, Czech copy gender-neutral (`:` separator rules), semantic color tokens only, tab bar labels are Czech (Domů / Moduly / Profil — matches existing Czech nav).

---

### Task 0: Baseline verification

**Files:** none

**Step 1: Confirm a clean baseline**

Run: `git status --short && git log --oneline -3`
Expected: worktree clean (only the committed design doc), branch `feature/navigation-update`.

**Step 2: Confirm typecheck + fast suite pass before any change**

Run: `pnpm typecheck && pnpm test`
Expected: exit 0, no errors.

---

### Task 1: Shared navigation config + unit test (TDD)

**Files:**
- Create: `src/lib/navigation.ts`
- Test: `src/lib/navigation.test.ts`
- Modify: `src/app/(main)/app-sidebar.tsx` → NO, sidebar refactor is Task 2.

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { NAV_MODULES, getVisibleModules } from "./navigation";

describe("navigation config", () => {
  it("contains every module with url, icon and Czech description", () => {
    expect(NAV_MODULES.length).toBeGreaterThanOrEqual(10);
    for (const m of NAV_MODULES) {
      expect(m.url).toMatch(/^\//);
      expect(m.icon).toBeDefined();
      expect(m.description.length).toBeGreaterThan(10);
    }
  });

  it("has unique urls", () => {
    const urls = NAV_MODULES.map((m) => m.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("marks beta-only modules", () => {
    expect(NAV_MODULES.filter((m) => m.betaOnly).length).toBeGreaterThan(0);
  });

  it("hides beta modules for non-beta users and shows all for beta users", () => {
    const visible = getVisibleModules(false);
    expect(visible.every((m) => !m.betaOnly)).toBe(true);
    expect(getVisibleModules(true).length).toBe(NAV_MODULES.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- src/lib/navigation.test.ts`
Expected: FAIL — module `./navigation` not found.

**Step 3: Write the implementation**

```ts
import {
  Activity,
  BookOpen,
  Brain,
  CalendarDays,
  Gift,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  NotebookPen,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavModule {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Hidden unless the user has beta access. */
  betaOnly?: boolean;
  /** One-line description shown on module cards. */
  description: string;
}

export const NAV_MODULES: NavModule[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Přehled vašich aktivit a rychlé akce." },
  { title: "Místnosti", url: "/reservations", icon: CalendarDays, description: "Rezervace místností a jejich nastavení." },
  { title: "Komunita", url: "/komunita", icon: Users, description: "Lidé, týmy a profily v Tiimiakatemii." },
  { title: "Zák. schůzky", url: "/schuzky", icon: Handshake, betaOnly: true, description: "Evidence zákaznických schůzek." },
  { title: "Koučování", url: "/koucovani", icon: GraduationCap, betaOnly: true, description: "Evidence koučovacích sezení." },
  { title: "Týmová reflexe", url: "/tymova-reflexe", icon: NotebookPen, betaOnly: true, description: "Reflexe týmové spolupráce a semestrální hodnocení." },
  { title: "Týmový deník", url: "/tymovy-denik", icon: Activity, betaOnly: true, description: "Denní zápisy a přehled týmových aktivit." },
  { title: "Nástroje a techniky", url: "/nastroje-techniky", icon: Wrench, betaOnly: true, description: "Katalog modelů, technik a nástrojů pro práci." },
  { title: "Osobnostní testy", url: "/komunita/profil", icon: Brain, betaOnly: true, description: "Výsledky osobnostních testů na vašem profilu." },
  { title: "Čtení", url: "/cteni/prehled", icon: BookOpen, betaOnly: true, description: "Knihovna knih, eseje a jejich hodnocení." },
  { title: "Birth Giving", url: "/birth-giving", icon: Gift, betaOnly: true, description: "Týmová setkání Birth Giving a retrospektivy." },
];

/** Modules a user can see — beta-gated like the sidebar. */
export function getVisibleModules(isBeta: boolean): NavModule[] {
  return NAV_MODULES.filter((m) => !m.betaOnly || isBeta);
}
```

(Note: descriptions are new Czech copy — gender-neutral per DESIGN.md; "vašich aktivit", "vašem profilu" avoid gendered participles.)

**Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- src/lib/navigation.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add src/lib/navigation.ts src/lib/navigation.test.ts
git commit -m "feat: extract shared module navigation config"
```

---

### Task 2: Refactor `AppSidebar` to render from `NAV_MODULES`

**Files:**
- Modify: `src/components/app-sidebar.tsx`

Behavior must stay identical (desktop sidebar). The existing special-case branches (Místnosti collapsible for coach/admin, Čtení collapsible, Osobnostní testy profile link) must run BEFORE the generic `betaOnly` branch, because `Čtení` and `Osobnostní testy` are now `betaOnly` in the shared config.

**Step 1: Replace `getNavData` with NAV_MODULES**

Delete the `NavItem`/`NavSection`/`NavData` types and `getNavData`, keep imports. Replace with:

```ts
import { NAV_MODULES, type NavModule } from "@/lib/navigation";

const DEV_INSPECT_ITEMS: NavModule[] = [
  { title: "Mailpit", url: "http://127.0.0.1:54324", icon: Mail, description: "", external: true },
  { title: "Supabase Studio", url: "http://127.0.0.1:54323", icon: Database, description: "", external: true },
];
```

Add `external?: boolean` to the `NavModule` interface in `src/lib/navigation.ts` (used only by dev items — no test change needed; the Task 1 test does not forbid it).

**Step 2: Reorder section rendering**

In `AppSidebarContent`, change the nav data source:

```tsx
const isDevelopment = process.env.NODE_ENV === "development";
const sections: { title: string; items: NavModule[] }[] = [
  { title: "Hlavní", items: NAV_MODULES },
  ...(isDevelopment ? [{ title: "Dev", items: DEV_INSPECT_ITEMS }] : []),
];
```

Replace the `.map` block `{getNavData(isDevelopment).navMain.map((section) => (` with `{sections.map((section) => (`.

**Step 3: Reorder the item branches inside the map**

Current order: Místnosti → betaOnly → Osobnostní testy → Čtení → standard.
New order (special cases first, then generic beta, then standard — logic bodies unchanged):

1. `if (item.title === "Místnosti" && isCoachOrAdmin)` — unchanged.
2. `if (item.title === "Čtení")` — unchanged body (`if (!isBeta) return null` + collapsible + subitems + review badge).
3. `if (item.title === "Osobnostní testy")` — unchanged body (`if (!isBeta || !user) return null` + profile link).
4. `if (item.betaOnly)` — unchanged (badge item). Now reached only for remaining beta items (Zák. schůzky, Koučování, Týmová reflexe, Týmový deník, Nástroje a techniky, Birth Giving). `item.activePrefix ?? item.url` still works (all urls equal their prefix).
5. Standard item — unchanged.

Also delete the now-unused `closeSidebarOnMobile`? NO — it is still used by collapsible sub-links, but never fires on mobile (sidebar is desktop-only after Task 4); keep it (harmless) — deletion is optional.

**Step 4: Verify no type errors and nothing broke**

Run: `pnpm typecheck && pnpm test`
Expected: exit 0. (No component test covers the sidebar; behavior preserved by identical JSX bodies.)

**Step 5: Commit**

```bash
git add src/components/app-sidebar.tsx src/lib/navigation.ts
git commit -m "refactor: sidebar renders modules from shared nav config"
```

---

### Task 3: `MobileBottomNav` component + test (TDD)

**Files:**
- Create: `src/components/navigation/mobile-bottom-nav.tsx`
- Test: `src/components/navigation/mobile-bottom-nav.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileBottomNav } from "./mobile-bottom-nav";

const pathname: { current: string } = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("MobileBottomNav", () => {
  it("renders all three tabs with correct hrefs", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("href", "/moduly");
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profil");
  });

  it("marks the active tab on the home page", () => {
    pathname.current = "/";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Moduly" })).not.toHaveAttribute("aria-current");
  });

  it("marks the Moduly tab as active on the hub and inside a module", () => {
    pathname.current = "/moduly";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("aria-current", "page");

    pathname.current = "/moduly/nastroje-techniky";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Moduly" })).toHaveAttribute("aria-current", "page");
  });

  it("marks the Profil tab as active on the hub", () => {
    pathname.current = "/profil";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  });

  it("leaves all tabs inactive on a module page", () => {
    pathname.current = "/reservations";
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Domů" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Moduly" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:component -- src/components/navigation/mobile-bottom-nav.test.tsx`
Expected: FAIL — module `./mobile-bottom-nav` not found.

**Step 3: Write the implementation**

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, LayoutGrid, User } from "lucide-react"

import { cn } from "@/lib/utils"

const TABS = [
  { title: "Domů", url: "/", icon: House },
  { title: "Moduly", url: "/moduly", icon: LayoutGrid },
  { title: "Profil", url: "/profil", icon: User },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/")

  return (
    <nav aria-label="Hlavní navigace" className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <div className="flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((tab) => {
          const active = isActive(tab.url)
          return (
            <Link
              key={tab.url}
              href={tab.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-transform active:scale-[0.98]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-5" aria-hidden />
              <span className="text-[11px] font-medium">{tab.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:component -- src/components/navigation/mobile-bottom-nav.test.tsx`
Expected: PASS (5 tests).

**Step 5: Commit**

```bash
git add src/components/navigation/mobile-bottom-nav.tsx src/components/navigation/mobile-bottom-nav.test.tsx
git commit -m "feat: mobile bottom navigation bar"
```

---

### Task 4: Wire layout — hide sidebar on mobile, remove floating feedback

**Files:**
- Modify: `src/app/(main)/layout.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Delete: `src/components/feedback/floating-feedback.tsx`

**Step 1: Make AppSidebar desktop-only**

In `app-sidebar.tsx`, `AppSidebar` function:

```tsx
export function AppSidebar({ user, reviewCount, ...props }: AppSidebarProps) {
  const { isMobile } = useSidebar()
  // Mobile gets the bottom navigation bar instead of the sidebar sheet.
  if (isMobile) return null
  return (
    <Sidebar {...props}>
      <AppSidebarContent user={user} reviewCount={reviewCount} />
    </Sidebar>
  )
}
```

`useSidebar` is already imported in that file.

**Step 2: Update the layout**

In `src/app/(main)/layout.tsx`:

- Remove `import { FloatingFeedback } from "@/components/feedback/floating-feedback";`
- Add `import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";`
- Wrap the return in a fragment:

```tsx
return (
  <>
    <SidebarProvider>
      <AppSidebar user={sidebarUser} reviewCount={reviewCount} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator
            orientation="vertical"
            className="mr-2 hidden md:block data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4">{children}</main>
        <footer className="hidden border-t p-4 md:block">
          <p className="text-center text-xs text-muted-foreground">
            Tiimiakatemia Prague {new Date().getFullYear()}
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
    <MobileBottomNav />
  </>
)
```

**Step 3: Delete the floating feedback component**

Run: `rm src/components/feedback/floating-feedback.tsx`
Verify no remaining references: `grep -rn "FloatingFeedback" src/` → no matches.

**Step 4: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: exit 0.

**Step 5: Commit**

```bash
git add -A src/app/\(main\)/layout.tsx src/components/app-sidebar.tsx
git add -u src/components/feedback/floating-feedback.tsx
git commit -m "feat: hide sidebar on mobile, add bottom nav, remove floating feedback"
```

---

### Task 5: `/moduly` hub page (TDD)

**Files:**
- Create: `src/components/navigation/module-grid.tsx`
- Test: `src/components/navigation/module-grid.test.tsx`
- Create: `src/app/(main)/moduly/page.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleGrid } from "./module-grid";
import { NAV_MODULES } from "@/lib/navigation";

describe("ModuleGrid", () => {
  it("renders a card per module with title, description and link", () => {
    render(<ModuleGrid modules={NAV_MODULES} />);
    expect(screen.getByRole("heading", { name: "Místnosti" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Místnosti/ })).toHaveAttribute("href", "/reservations");
    expect(screen.getByText(/Rezervace místností/)).toBeInTheDocument();
  });

  it("shows a Beta badge on beta-only modules", () => {
    render(<ModuleGrid modules={NAV_MODULES} />);
    expect(screen.getAllByText("Beta").length).toBe(NAV_MODULES.filter((m) => m.betaOnly).length);
  });

  it("links the personality tests card to the own profile tab when profileId is given", () => {
    render(<ModuleGrid modules={NAV_MODULES} profileId="user-1" />);
    const link = screen.getByRole("link", { name: /Osobnostní testy/ });
    expect(link).toHaveAttribute("href", "/komunita/profil/user-1?tab=osobnostni-testy");
  });
});
```

Careful with the accessible name of the Osobnostní testy link: the card contains title inside an `<h2>`, so the link's accessible name may be empty string (Link wraps everything). If `screen.getByRole("link", { name: /Osobnostní testy/ })` does not match, switch the assertion to:

```tsx
const link = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/komunita/profil/user-1?tab=osobnostni-testy");
expect(link).toBeTruthy();
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:component -- src/components/navigation/module-grid.test.tsx`
Expected: FAIL — module `./module-grid` not found.

**Step 3: Write the implementation**

```tsx
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { NavModule } from "@/lib/navigation";

interface ModuleGridProps {
  modules: NavModule[];
  /** Enables the own-profile link for Osobnostní testy. */
  profileId?: string;
}

export function ModuleGrid({ modules, profileId }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {modules.map((m) => {
        const href =
          m.title === "Osobnostní testy" && profileId
            ? `/komunita/profil/${profileId}?tab=osobnostni-testy`
            : m.url
        return (
          <Link
            key={m.title}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <m.icon className="size-5" aria-hidden />
              </div>
              {m.betaOnly && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Beta
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold leading-tight">{m.title}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

**Step 4: Create the page**

```tsx
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { getVisibleModules } from "@/lib/navigation";
import { ModuleGrid } from "@/components/navigation/module-grid";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = {
  title: "Moduly | Tappka",
  description: "Všechny moduly Tappky na jednom místě",
};

export default async function ModulyPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  const isBeta = profile.beta_access_granted_at != null;

  return (
    <PageShell>
      <PageHeader
        title="Moduly"
        description="Všechny části Tappky na jednom místě."
      />
      <ModuleGrid modules={getVisibleModules(isBeta)} profileId={profile.id} />
    </PageShell>
  );
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test:component -- src/components/navigation/module-grid.test.tsx && pnpm typecheck`
Expected: PASS, exit 0.

**Step 6: Commit**

```bash
git add src/components/navigation/module-grid.tsx src/components/navigation/module-grid.test.tsx "src/app/(main)/moduly/page.tsx"
git commit -m "feat: modules hub page with beta-gated module cards"
```

---

### Task 6: `/profil` hub page (TDD)

**Files:**
- Create: `src/components/navigation/profile-hub.tsx`
- Test: `src/components/navigation/profile-hub.test.tsx`
- Create: `src/app/(main)/profil/page.tsx`

**Step 1: Write the failing test**

```tsx
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:component -- src/components/navigation/profile-hub.test.tsx`
Expected: FAIL — module `./profile-hub` not found.

**Step 3: Write the implementation**

```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Bell,
  BriefcaseBusiness,
  FlaskConical,
  Heart,
  Laptop,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface ProfileHubProps {
  user: {
    id: string
    name: string
    email: string
    role?: string
    beta_access?: boolean
  }
}

const THEME_OPTIONS = [
  { value: "light", label: "Světlé", icon: Sun },
  { value: "dark", label: "Tmavé", icon: Moon },
  { value: "system", label: "Systém", icon: Laptop },
] as const

export function ProfileHub({ user }: ProfileHubProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <Avatar className="size-12 rounded-xl">
          <AvatarFallback className="rounded-xl">{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.role && <p className="text-xs text-muted-foreground capitalize">{user.role}</p>}
        </div>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <Link href={`/komunita/profil/${user.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent">
          <UserIcon className="size-4 text-muted-foreground" />
          Můj profil
        </Link>
        <Link href="/settings/notifikace" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent">
          <Bell className="size-4 text-muted-foreground" />
          Notifikace
        </Link>
        {user.beta_access && (
          <Link href="/portfolio" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <span className="flex-1">Portfolio</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              Beta
            </Badge>
          </Link>
        )}
        <Link href="/zpetna-vazba" className="flex items-center gap-3 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60">
          <Heart className="size-4" />
          Zpětná vazba
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Téma</p>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((o) => (
            <Button
              key={o.value}
              variant={theme === o.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(o.value)}
            >
              <o.icon className="mr-1.5 size-4" />
              {o.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <Link href="/beta" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent">
          <FlaskConical className="size-4 text-muted-foreground" />
          Beta přístup
        </Link>
        <button
          type="button"
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent",
            "text-destructive",
          )}
        >
          <LogOut className="size-4" />
          Odhlásit se
        </button>
      </div>
    </div>
  )
}
```

Note: raw `<button>` is allowed here only for the logout row inside a card list (no Dialog needed, matches `nav-user.tsx` pattern) — but AGENTS.md forbids raw `<button>`... it says use shared primitives, "never raw `<button>`". Logout in nav-user uses `DropdownMenuItem`. Here a list row must be a button — I'll use `Button variant="ghost"` styling? `Button` renders a `<button>` with shadcn classes; className override for full-width row: `<Button type="button" variant="ghost" onClick={logout} className="flex w-full items-center justify-start gap-3 rounded-none px-4 py-3 h-auto text-sm">`. Use that instead of raw button.

**Step 4: Create the page**

```tsx
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { ProfileHub } from "@/components/navigation/profile-hub";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";

export const metadata = {
  title: "Profil | Tappka",
  description: "Váš profil a nastavení",
};

export default async function ProfilPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth/login");

  return (
    <PageShell size="medium">
      <PageHeader
        title="Profil"
        description="Váš účet, přístupy a nastavení aplikace."
      />
      <ProfileHub
        user={{
          id: profile.id,
          name: profile.name ?? "",
          email: profile.work_email,
          role: profile.role,
          beta_access: profile.beta_access_granted_at != null,
        }}
      />
    </PageShell>
  );
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test:component -- src/components/navigation/profile-hub.test.tsx && pnpm typecheck`
Expected: PASS, exit 0.

**Step 6: Commit**

```bash
git add src/components/navigation/profile-hub.tsx src/components/navigation/profile-hub.test.tsx "src/app/(main)/profil/page.tsx"
git commit -m "feat: profile hub page for mobile"
```

---

### Task 7: Full verification

**Files:** none

**Step 1: Run everything**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: all exit 0.

**Step 2: Manual visual check (both themes, narrow viewport)**

Run: `pnpm dev`, open at ~390px width (DevTools responsive mode). Verify:
- No sidebar hamburger/sheet on mobile; bottom bar visible with 3 tabs.
- `/moduly` shows cards (beta user sees all 11, non-beta sees Dashboard/Místnosti/Komunita).
- `/profil` shows user card, rows, theme switcher, logout works.
- Content cannot be hidden behind the bar (last card fully visible).
- Header shows breadcrumb, no burger.
- Light + dark themes both render correctly (semantic tokens).

**Step 3: Commit any fixes from the manual check.**

---

## Out of scope

- Desktop sidebar behavior (unchanged).
- Module internals (no new module routes).
- The active-module "ring" on the Moduly hub (dropped — would force the server page to become client; the hub is a directory, YAGNI).
- E2E tests (component + unit coverage suffices for navigation; existing E2E suite untouched).