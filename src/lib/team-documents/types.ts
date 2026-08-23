import type { Profile } from "@/lib/auth-helpers"
import type { Database } from "@/lib/supabase/database.types"
import type { Tables } from "@/lib/supabase/tables"

export type TeamDocument = Tables<"team_documents">
export type TeamDocumentVersion = Tables<"team_document_versions">
export type TeamDocumentType = Database["public"]["Enums"]["team_document_type"]

export interface TeamDocumentVersionWithCreator extends TeamDocumentVersion {
  created_by: Pick<Profile, "id" | "name" | "picture"> | null
}

export interface TeamDocumentWithVersions extends TeamDocument {
  versions: TeamDocumentVersionWithCreator[]
}

export const TEAM_DOCUMENT_TYPES = [
  "team_contract",
  "financial_policy",
  "other",
] as const satisfies readonly TeamDocumentType[]

export const TEAM_DOCUMENT_TYPE_LABELS: Record<TeamDocumentType, string> = {
  team_contract: "Team Contract",
  financial_policy: "Finanční směrnice",
  other: "Další dokument",
}

export const TEAM_DOCUMENT_VERSION_WITH_CREATOR_SELECT =
  "*, created_by:profiles!created_by_profile_id(id, name, picture)"

export function getTeamDocumentTitle(
  document: Pick<TeamDocument, "doc_type" | "title">,
): string {
  return document.doc_type === "other"
    ? document.title ?? TEAM_DOCUMENT_TYPE_LABELS.other
    : TEAM_DOCUMENT_TYPE_LABELS[document.doc_type]
}
