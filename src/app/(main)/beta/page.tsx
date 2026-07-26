import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserProfile } from "@/lib/auth-helpers"
import { BetaPageContent } from "@/components/beta/beta-page-content"

export default async function BetaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const profile = await getCurrentUserProfile(supabase, { user })
  const betaAccess = profile?.beta_access_granted_at != null

  return <BetaPageContent initialBetaAccess={betaAccess} />
}
