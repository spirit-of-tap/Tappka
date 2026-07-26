"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Eye, MessageSquare, Users, ArrowRight } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

interface BetaPageContentProps {
  initialBetaAccess: boolean
}

export function BetaPageContent({ initialBetaAccess }: BetaPageContentProps) {
  const router = useRouter()
  const [betaAccess, setBetaAccess] = useState(initialBetaAccess)
  const [saving, setSaving] = useState(false)

  const handleToggle = async (value: boolean) => {
    setSaving(true)
    setBetaAccess(value)

    try {
      const res = await fetch("/api/profile/beta-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beta_access: value }),
      })

      if (!res.ok) {
        setBetaAccess(!value)
      }

      router.refresh()
    } catch {
      setBetaAccess(!value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.02] px-6 py-8 sm:px-8 sm:py-10">
        <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm sm:size-16">
            <FlaskConical className="size-7 text-primary-foreground sm:size-8" />
          </div>
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-heading text-xl font-bold sm:text-2xl">Beta přístup</h1>
              <Badge variant="secondary" className="text-[10px]">Experimentální</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Získej přístup k novým funkcím jako první a pomoz nám je vyladit.
            </p>
          </div>
        </div>
      </section>

      {/* What + perks combined */}
      <Card className="border-0 bg-muted/30 shadow-none">
        <CardHeader>
          <CardDescription className="text-sm leading-relaxed sm:text-base">
            Beta ti dává přednostní přístup k funkcím, které postupně připravujeme. Počítáme s tebou —
            budeme se občas ptát na tvůj názor a na podzim chystáme focus group, kde společně
            zaměříme směr Tappky.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg bg-background p-3">
              <Eye className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Všímej si věcí</p>
                <p className="text-xs text-muted-foreground">Každý postřeh se počítá</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-background p-3">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Zpětná vazba</p>
                <p className="text-xs text-muted-foreground">Tvůj názor formuje Tappku</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-background p-3">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Focus group</p>
                <p className="text-xs text-muted-foreground">V září společně</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans — simplified */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base">
            <ArrowRight className="size-4 text-primary" />
            Co chystáme
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Celé portfolio postupně převádíme do Tappky — přehledy, reflexe, finanční reporty,
            týmové nástroje a další. Vše na jednom místě, hezky digitálně.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Toggle */}
      <section className="space-y-3">
        {betaAccess ? (
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <FlaskConical className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-heading text-base">Máš beta přístup</CardTitle>
                    <CardDescription className="text-sm">
                      Užívej nové funkce a dej nám vědět, co si o nich myslíš.
                    </CardDescription>
                  </div>
                </div>
                <Badge className="bg-primary text-primary-foreground">Aktivní</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
                <span className="text-sm text-muted-foreground">Vypnout beta přístup</span>
                <Switch
                  id="beta-access"
                  checked={betaAccess}
                  onCheckedChange={handleToggle}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            className="cursor-pointer border-2 border-dashed transition-colors hover:border-primary/40"
            onClick={() => !saving && handleToggle(true)}
          >
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FlaskConical className="size-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-heading text-base font-semibold">Zapnout beta přístup</p>
                <p className="text-sm text-muted-foreground">
                  Získej přístup k experimentálním funkcím
                </p>
              </div>
              <Switch
                id="beta-access"
                checked={false}
                onCheckedChange={handleToggle}
                disabled={saving}
              />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
