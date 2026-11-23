"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Settings,
  BriefcaseBusiness,
  FlaskConical,
  Heart,
  Laptop,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Palette,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BetaBadge } from "@/components/beta-badge"
import { Button } from "@/components/ui/button"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import { getAvatarUrl } from "@/lib/storage/public-url"
import { SETTINGS_ROUTES } from "@/lib/settings/sections"
import { createClient } from "@/lib/supabase/client"
import posthog from "posthog-js"

interface ProfileHubProps {
  user: {
    id: string
    name: string
    email: string
    /** Raw ref from profiles.picture — storage key or external URL. */
    picture?: string | null
    role?: string
    beta_access?: boolean
    beta_access_granted_at?: string | null
    beta_cohort?: BetaCohort
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
  const accessProfile = {
    role: user.role ?? "student",
    beta_access_granted_at: user.beta_access_granted_at ?? (user.beta_access ? "1970-01-01T00:00:00Z" : null) ?? null,
    beta_cohort: (user.beta_cohort ?? (user.beta_access ? "B" : "A")) as BetaCohort,
  }
  const canViewPortfolio = canAccessFeature(accessProfile, "portfolio")

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  const logout = async () => {
    try {
      posthog.reset()
    } catch {
      // ignore
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <Avatar className="size-12 rounded-xl">
          {user.picture && (
            <AvatarImage src={getAvatarUrl(user.picture) ?? undefined} alt={user.name} />
          )}
          <AvatarFallback className="rounded-xl">{getInitials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.role && <p className="text-xs text-muted-foreground">{user.role}</p>}
        </div>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <Link href={`/komunita/profil/${user.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent focus-ring">
          <UserIcon className="size-4 text-muted-foreground" />
          Můj profil
        </Link>
        <Link href={SETTINGS_ROUTES.root} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent focus-ring">
          <Settings className="size-4 text-muted-foreground" />
          Nastavení
        </Link>
        {canViewPortfolio && (
          <Link href="/portfolio" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent focus-ring">
            <BriefcaseBusiness className="size-4 text-muted-foreground" />
            <span className="flex-1">Portfolio</span>
            <BetaBadge />
          </Link>
        )}
        <Link href="/zpetna-vazba" className="flex items-center gap-3 bg-primary/5 px-4 py-3 text-sm text-primary hover:bg-primary/10 focus-ring">
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
              aria-pressed={theme === o.value}
              onClick={() => setTheme(o.value)}
            >
              <o.icon className="mr-1.5 size-4" />
              {o.label}
            </Button>
          ))}
        </div>
        <Link href={SETTINGS_ROUTES.vzhled} className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline underline-offset-4">
          <Palette className="size-4" aria-hidden />
          Barevné motivy
        </Link>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <Link href="/beta" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent focus-ring">
          <FlaskConical className="size-4 text-muted-foreground" />
          Beta přístup
        </Link>
        <Button
          type="button"
          variant="ghost"
          onClick={logout}
          className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-3 text-left text-sm text-destructive hover:text-destructive"
        >
          <LogOut className="size-4" />
          Odhlásit se
        </Button>
      </div>
    </div>
  )
}
