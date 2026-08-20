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
          {user.role && <p className="text-xs capitalize text-muted-foreground">{user.role}</p>}
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
