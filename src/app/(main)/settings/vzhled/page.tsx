import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { PageHeader } from "@/components/ui/page-header"

const PAGE_TITLE = "Vzhled"
const PAGE_DESCRIPTION = "Vyber si režim a barevný motiv pro tenhle prohlížeč"

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
}

export default function AppearanceSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <AppearanceSettings />
    </div>
  )
}
