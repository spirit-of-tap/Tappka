import { redirect } from "next/navigation"

export default async function SemestralniReflexeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/tymova-reflexe/rocnikova/${id}`)
}
