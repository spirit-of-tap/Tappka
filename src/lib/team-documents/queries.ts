import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  TEAM_DOCUMENT_VERSION_WITH_CREATOR_SELECT,
  type TeamDocument,
  type TeamDocumentVersionWithCreator,
  type TeamDocumentWithVersions,
} from "./types"

export async function listTeamDocuments(
  supabase: SupabaseClient<Database>,
  teamId: string,
): Promise<TeamDocumentWithVersions[]> {
  const { data: documents, error: documentsError } = await supabase
    .from("team_documents")
    .select("*")
    .eq("team_id", teamId)
    .is("removed_at", null)
    .order("created_at", { ascending: true })

  if (documentsError) throw documentsError
  if (!documents?.length) return []

  const documentRows = documents as TeamDocument[]
  const { data: versions, error: versionsError } = await supabase
    .from("team_document_versions")
    .select(TEAM_DOCUMENT_VERSION_WITH_CREATOR_SELECT)
    .in("document_id", documentRows.map((document) => document.id))
    .order("version_no", { ascending: false })

  if (versionsError) throw versionsError

  const versionsByDocument = new Map<string, TeamDocumentVersionWithCreator[]>()
  for (const version of (versions ?? []) as TeamDocumentVersionWithCreator[]) {
    const documentVersions = versionsByDocument.get(version.document_id) ?? []
    documentVersions.push(version)
    versionsByDocument.set(version.document_id, documentVersions)
  }

  return documentRows.map((document) => ({
    ...document,
    versions: versionsByDocument.get(document.id) ?? [],
  }))
}
