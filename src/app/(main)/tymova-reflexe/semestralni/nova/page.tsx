import { redirect } from "next/navigation"

export default async function SemestralniNovaPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string; month?: string }>
}) {
  const params = await searchParams
  const query = params.semester ? `?month=${params.semester}` : params.month ? `?month=${params.month}` : ""
  redirect(`/tymova-reflexe/rocnikova/nova${query}`)
}
