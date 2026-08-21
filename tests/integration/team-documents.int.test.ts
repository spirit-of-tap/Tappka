import type { PoolClient } from "pg"
import { describe, expect, it } from "vitest"

import { insertAuthUser } from "@/tests/setup/factories"
import { asClaims } from "@/tests/setup/rls"
import { withRollback } from "@/tests/setup/tx"

async function seed(client: PoolClient) {
  const memberAuth = await insertAuthUser(client)
  const teammateAuth = await insertAuthUser(client)
  const outsiderAuth = await insertAuthUser(client)

  const { rows: userRows } = await client.query(
    "select id, auth_user_id from public.users where auth_user_id = any($1)",
    [[memberAuth.id, teammateAuth.id, outsiderAuth.id]],
  )
  const userIdByAuthId = new Map<string, string>(
    userRows.map((row: { id: string; auth_user_id: string }) => [row.auth_user_id, row.id]),
  )
  await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where id = any($1)",
    [[...userIdByAuthId.values()]],
  )

  const { rows: teamRows } = await client.query(
    "insert into public.teams (name) values ('Document Team'), ('Other Team') returning id",
  )
  const teamId = teamRows[0].id as string
  const otherTeamId = teamRows[1].id as string

  const { rows: profileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values
       ('Member', 'documents-member@studenti.czu.cz', $1, $4, 'student'),
       ('Teammate', 'documents-teammate@studenti.czu.cz', $2, $4, 'student'),
       ('Outsider', 'documents-outsider@studenti.czu.cz', $3, $5, 'student')
     returning id, name`,
    [
      userIdByAuthId.get(memberAuth.id),
      userIdByAuthId.get(teammateAuth.id),
      userIdByAuthId.get(outsiderAuth.id),
      teamId,
      otherTeamId,
    ],
  )
  const profileIdByName = new Map<string, string>(
    profileRows.map((row: { id: string; name: string }) => [row.name, row.id]),
  )

  return {
    teamId,
    otherTeamId,
    memberAuthId: memberAuth.id,
    teammateAuthId: teammateAuth.id,
    outsiderAuthId: outsiderAuth.id,
    memberProfileId: profileIdByName.get("Member")!,
    teammateProfileId: profileIdByName.get("Teammate")!,
    outsiderProfileId: profileIdByName.get("Outsider")!,
  }
}

async function insertDocument(
  client: PoolClient,
  teamId: string,
  profileId: string,
  documentType: "team_contract" | "financial_policy" | "other",
  title: string | null = null,
) {
  const { rows } = await client.query(
    `insert into public.team_documents
       (team_id, doc_type, title, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4)
     returning id`,
    [teamId, documentType, title, profileId],
  )
  return rows[0].id as string
}

async function insertVersion(
  client: PoolClient,
  documentId: string,
  profileId: string,
  versionNumber = 1,
) {
  const { rows } = await client.query(
    `insert into public.team_document_versions
       (document_id, version_no, file_path, file_name, file_size, created_by_profile_id)
     values ($1, $2, $3, $4, 1024, $5)
     returning id`,
    [
      documentId,
      versionNumber,
      `team-document/${documentId}/version-${versionNumber}.pdf`,
      `version-${versionNumber}.pdf`,
      profileId,
    ],
  )
  return rows[0].id as string
}

describe("team documents schema and RLS", () => {
  it("lets team members create and read their team's documents", async () => {
    await withRollback(async (client) => {
      const { teamId, memberAuthId, memberProfileId, teammateAuthId } = await seed(client)

      await asClaims(client, { sub: memberAuthId })
      await insertDocument(client, teamId, memberProfileId, "team_contract")

      await asClaims(client, { sub: teammateAuthId })
      const { rows } = await client.query(
        "select doc_type from public.team_documents where team_id = $1",
        [teamId],
      )

      expect(rows).toEqual([{ doc_type: "team_contract" }])
    })
  })

  it("isolates documents from members of other teams", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId, outsiderAuthId, outsiderProfileId } = await seed(client)
      await insertDocument(client, teamId, memberProfileId, "team_contract")

      await asClaims(client, { sub: outsiderAuthId })
      const { rows } = await client.query(
        "select id from public.team_documents where team_id = $1",
        [teamId],
      )
      expect(rows).toHaveLength(0)

      await expect(
        insertDocument(client, teamId, outsiderProfileId, "other", "Cizí dokument"),
      ).rejects.toThrow()
    })
  })

  it("allows one featured document of each type and multiple custom documents", async () => {
    await withRollback(async (client) => {
      const { teamId, memberAuthId, memberProfileId } = await seed(client)
      await asClaims(client, { sub: memberAuthId })

      await insertDocument(client, teamId, memberProfileId, "team_contract")
      await insertDocument(client, teamId, memberProfileId, "financial_policy")
      await insertDocument(client, teamId, memberProfileId, "other", "Pravidla porad")
      await insertDocument(client, teamId, memberProfileId, "other", "Zápisy")

      const { rows } = await client.query(
        "select doc_type, title from public.team_documents where team_id = $1 order by created_at",
        [teamId],
      )
      expect(rows).toHaveLength(4)

      await expect(
        insertDocument(client, teamId, memberProfileId, "team_contract"),
      ).rejects.toThrow()
    })
  })

  it("requires a non-empty title for custom documents", async () => {
    await withRollback(async (client) => {
      const { teamId, memberAuthId, memberProfileId } = await seed(client)
      await asClaims(client, { sub: memberAuthId })

      await expect(
        insertDocument(client, teamId, memberProfileId, "other", "   "),
      ).rejects.toThrow()
    })
  })

  it("lets team members add and read immutable document versions", async () => {
    await withRollback(async (client) => {
      const {
        teamId,
        memberProfileId,
        teammateAuthId,
        teammateProfileId,
        outsiderAuthId,
      } = await seed(client)
      const documentId = await insertDocument(
        client,
        teamId,
        memberProfileId,
        "other",
        "Týmová pravidla",
      )

      await asClaims(client, { sub: teammateAuthId })
      const versionId = await insertVersion(client, documentId, teammateProfileId)

      const { rows } = await client.query(
        "select version_no from public.team_document_versions where document_id = $1",
        [documentId],
      )
      expect(rows).toEqual([{ version_no: 1 }])

      const updateResult = await client.query(
        "update public.team_document_versions set change_note = 'Změněno' where id = $1",
        [versionId],
      )
      expect(updateResult.rowCount).toBe(0)

      const deleteResult = await client.query(
        "delete from public.team_document_versions where id = $1",
        [versionId],
      )
      expect(deleteResult.rowCount).toBe(0)

      await asClaims(client, { sub: outsiderAuthId })
      const { rows: outsiderRows } = await client.query(
        "select id from public.team_document_versions where document_id = $1",
        [documentId],
      )
      expect(outsiderRows).toHaveLength(0)
    })
  })

  it("allows renaming and archiving only custom documents", async () => {
    await withRollback(async (client) => {
      const { teamId, memberAuthId, memberProfileId } = await seed(client)
      const customId = await insertDocument(
        client,
        teamId,
        memberProfileId,
        "other",
        "Původní název",
      )
      const featuredId = await insertDocument(
        client,
        teamId,
        memberProfileId,
        "team_contract",
      )

      await asClaims(client, { sub: memberAuthId })
      const customUpdate = await client.query(
        `update public.team_documents
         set title = 'Nový název', removed_at = now(), updated_by_profile_id = $2
         where id = $1`,
        [customId, memberProfileId],
      )
      expect(customUpdate.rowCount).toBe(1)

      const featuredUpdate = await client.query(
        "update public.team_documents set removed_at = now() where id = $1",
        [featuredId],
      )
      expect(featuredUpdate.rowCount).toBe(0)
    })
  })

  it("cascades document history when a team is deleted", async () => {
    await withRollback(async (client) => {
      const { teamId, memberProfileId } = await seed(client)
      const documentId = await insertDocument(
        client,
        teamId,
        memberProfileId,
        "other",
        "Archiv",
      )
      await insertVersion(client, documentId, memberProfileId)

      await client.query("set local role service_role")
      await client.query("delete from public.teams where id = $1", [teamId])

      const { rows } = await client.query(
        `select
           (select count(*)::int from public.team_documents where team_id = $1) as documents,
           (select count(*)::int from public.team_document_versions where document_id = $2) as versions`,
        [teamId, documentId],
      )
      expect(rows[0]).toEqual({ documents: 0, versions: 0 })
    })
  })
})
