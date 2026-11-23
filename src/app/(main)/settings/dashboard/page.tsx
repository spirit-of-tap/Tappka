import { redirect } from "next/navigation"

import { DashboardWidgetSettings } from "@/components/settings/dashboard-widget-settings"
import { PageHeader } from "@/components/ui/page-header"
import { getSessionProfile } from "@/lib/auth/session"
import { availableWidgets, resolveDashboardWidgets, widgetsForRole } from "@/lib/dashboard/types"
import { canAccessFeature } from "@/lib/feature-access"
import { createClient } from "@/lib/supabase/server"

const PAGE_TITLE = "Dashboard"
const PAGE_DESCRIPTION = "Vyber, co uvidíš na úvodní stránce. Pořadí je pevné, aby byl dashboard přehledný."

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
}

export default async function DashboardSettingsPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")

  const supabase = await createClient()
  const { data: layoutRow } = await supabase
    .from("dashboard_layouts")
    .select("widgets")
    .eq("profile_id", profile.id)
    .maybeSingle()

  const hasMetricsAccess = canAccessFeature(
    {
      role: profile.role,
      beta_access_granted_at: profile.beta_access_granted_at,
      beta_cohort: profile.beta_cohort ?? "A",
    },
    "dashboardMetrics",
  )

  return (
    <div className="space-y-6">
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <DashboardWidgetSettings
        widgets={availableWidgets(widgetsForRole(profile.role), hasMetricsAccess)}
        shown={resolveDashboardWidgets(layoutRow?.widgets, profile.role, hasMetricsAccess)}
      />
    </div>
  )
}
