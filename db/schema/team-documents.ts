// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { sql } from "drizzle-orm"
import {
	check,
	date,
	foreignKey,
	integer,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core"

import { profiles } from "./profiles"
import { teams } from "./teams"

export const teamDocumentType = pgEnum("team_document_type", [
	"team_contract",
	"financial_policy",
	"other",
])

export const teamDocuments = pgTable("team_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teamId: uuid("team_id").notNull(),
	docType: teamDocumentType("doc_type").notNull(),
	title: text(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("team_documents_featured_team_type_idx")
		.using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.docType.asc().nullsLast().op("enum_ops"))
		.where(sql`doc_type IN ('team_contract', 'financial_policy') AND removed_at IS NULL`),
	foreignKey({
		columns: [table.teamId],
		foreignColumns: [teams.id],
		name: "team_documents_team_id_fkey",
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.createdByProfileId],
		foreignColumns: [profiles.id],
		name: "team_documents_created_by_profile_id_fkey",
	}).onDelete("restrict"),
	foreignKey({
		columns: [table.updatedByProfileId],
		foreignColumns: [profiles.id],
		name: "team_documents_updated_by_profile_id_fkey",
	}).onDelete("restrict"),
	check("team_documents_title_matches_type", sql`(
		(doc_type = 'other' AND title IS NOT NULL AND length(trim(title)) > 0)
		OR (doc_type <> 'other' AND title IS NULL)
	)`),
	pgPolicy("Team members can view documents", {
		as: "permissive",
		for: "select",
		to: ["authenticated"],
		using: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
	}),
	pgPolicy("Team members can create documents", {
		as: "permissive",
		for: "insert",
		to: ["authenticated"],
		withCheck: sql`team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) AND created_by_profile_id = current_profile_id() AND updated_by_profile_id = current_profile_id()`,
	}),
	pgPolicy("Team members can update custom documents", {
		as: "permissive",
		for: "update",
		to: ["authenticated"],
		using: sql`doc_type = 'other' AND team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL)`,
		withCheck: sql`doc_type = 'other' AND team_id IN (SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL) AND updated_by_profile_id = current_profile_id()`,
	}),
]).enableRLS()

export const teamDocumentVersions = pgTable("team_document_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	versionNo: integer("version_no").notNull(),
	filePath: text("file_path").notNull(),
	fileName: text("file_name").notNull(),
	fileSize: integer("file_size").notNull(),
	effectiveFrom: date("effective_from"),
	changeNote: text("change_note"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
}, (table) => [
	uniqueIndex("team_document_versions_document_version_idx")
		.using("btree", table.documentId.asc().nullsLast().op("uuid_ops"), table.versionNo.asc().nullsLast().op("int4_ops")),
	foreignKey({
		columns: [table.documentId],
		foreignColumns: [teamDocuments.id],
		name: "team_document_versions_document_id_fkey",
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.createdByProfileId],
		foreignColumns: [profiles.id],
		name: "team_document_versions_created_by_profile_id_fkey",
	}).onDelete("restrict"),
	check("team_document_versions_version_positive", sql`version_no > 0`),
	check("team_document_versions_file_size_positive", sql`file_size > 0`),
	pgPolicy("Team members can view document versions", {
		as: "permissive",
		for: "select",
		to: ["authenticated"],
		using: sql`document_id IN (
			SELECT team_documents.id
			FROM team_documents
			WHERE team_documents.team_id IN (
				SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL
			)
		)`,
	}),
	pgPolicy("Team members can create document versions", {
		as: "permissive",
		for: "insert",
		to: ["authenticated"],
		withCheck: sql`created_by_profile_id = current_profile_id() AND document_id IN (
			SELECT team_documents.id
			FROM team_documents
			WHERE team_documents.removed_at IS NULL
				AND team_documents.team_id IN (
					SELECT team_id FROM profiles WHERE id = current_profile_id() AND access_removed_at IS NULL
				)
		)`,
	}),
]).enableRLS()
