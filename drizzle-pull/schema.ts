import { pgTable, foreignKey, pgPolicy, uuid, jsonb, timestamp, index, check, text, boolean, integer, unique, smallint, numeric, time, date, primaryKey, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const bookSource = pgEnum("book_source", ['manual', 'google_books', 'open_library'])
export const bookStatus = pgEnum("book_status", ['pending', 'approved', 'rejected'])
export const issueStatus = pgEnum("issue_status", ['open', 'resolved'])
export const issueType = pgEnum("issue_type", ['locked', 'mess', 'technical', 'other'])
export const profileRole = pgEnum("profile_role", ['student', 'mentor', 'coach', 'admin'])
export const reservationType = pgEnum("reservation_type", ['personal', 'training_session', 'houston_calling'])
export const scheduleBreakType = pgEnum("schedule_break_type", ['days_of_joy', 'holiday', 'other'])


export const dashboardLayouts = pgTable("dashboard_layouts", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	widgets: jsonb().default([]).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "dashboard_layouts_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can delete their own dashboard layout", { as: "permissive", for: "delete", to: ["public"], using: sql`(profile_id = current_profile_id())` }),
	pgPolicy("Users can update their own dashboard layout", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can insert their own dashboard layout", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("Users can view their own dashboard layout", { as: "permissive", for: "select", to: ["public"] }),
]);

export const essayComments = pgTable("essay_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	essayId: uuid("essay_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isLindaNudge: boolean("is_linda_nudge").default(false).notNull(),
	nudgeStatus: text("nudge_status"),
}, (table) => [
	index("essay_comments_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essay_comments_essay_idx").using("btree", table.essayId.asc().nullsLast().op("uuid_ops")),
	index("essay_comments_open_linda_nudge_idx").using("btree", table.essayId.asc().nullsLast().op("uuid_ops")).where(sql`(is_linda_nudge AND (nudge_status = 'open'::text))`),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_comments_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "essay_comments_author_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authors and admins can delete essay comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own essay comments", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add essay comments", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view essay comments", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("essay_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
	check("essay_comments_nudge_status_check", sql`(nudge_status IS NULL) OR (nudge_status = ANY (ARRAY['open'::text, 'resolved'::text]))`),
]);

export const bookComments = pgTable("book_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("book_comments_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("book_comments_book_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "book_comments_book_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "book_comments_author_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authors and admins can delete book comments", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`((author_profile_id = current_profile_id()) OR is_admin())` }),
	pgPolicy("Authors can update their own book comments", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add book comments", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view book comments", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("book_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]);

export const essays = pgTable("essays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authorProfileId: uuid("author_profile_id").notNull(),
	bookId: uuid("book_id"),
	title: text().notNull(),
	contentJson: jsonb("content_json").default({}).notNull(),
	contentText: text("content_text").default(').notNull(),
	published: boolean().default(true).notNull(),
	viewCount: integer("view_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	voteCount: integer("vote_count").default(0).notNull(),
}, (table) => [
	index("essays_author_idx").using("btree", table.authorProfileId.asc().nullsLast().op("uuid_ops")),
	index("essays_book_idx").using("btree", table.bookId.asc().nullsLast().op("uuid_ops")),
	index("essays_content_text_tsv_idx").using("gin", sql`to_tsvector('simple'::regconfig, content_text)`),
	index("essays_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("essays_title_trgm_idx").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	index("essays_vote_count_idx").using("btree", table.voteCount.desc().nullsFirst().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.authorProfileId],
			foreignColumns: [profiles.id],
			name: "essays_author_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "essays_book_id_fkey"
		}).onDelete("set null"),
	pgPolicy("Authors can create their own essays", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(author_profile_id = current_profile_id())`  }),
	pgPolicy("Authenticated users can view all essays", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Authors and admins can delete essays", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Authors can update their own essays", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const books = pgTable("books", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	author: text().notNull(),
	isbn13: text("isbn_13"),
	description: text(),
	coverPath: text("cover_path"),
	tags: text().array().default([""]).notNull(),
	suggestedPoints: smallint("suggested_points").default(1).notNull(),
	bookPoints: numeric("book_points", { precision: 5, scale:  2 }).default('0').notNull(),
	status: bookStatus().default('pending').notNull(),
	addedByProfileId: uuid("added_by_profile_id").notNull(),
	approvedByProfileId: uuid("approved_by_profile_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	source: bookSource().default('manual').notNull(),
	externalId: text("external_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	aiBookPoints: smallint("ai_book_points"),
	legacyBookPoints: numeric("legacy_book_points", { precision: 5, scale:  2 }),
	aiReason: text("ai_reason"),
}, (table) => [
	index("books_added_by_idx").using("btree", table.addedByProfileId.asc().nullsLast().op("uuid_ops")),
	index("books_author_trgm_idx").using("gin", table.author.asc().nullsLast().op("gin_trgm_ops")),
	index("books_created_desc_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("books_isbn_13_idx").using("btree", table.isbn13.asc().nullsLast().op("text_ops")).where(sql`(isbn_13 IS NOT NULL)`),
	index("books_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("books_title_trgm_idx").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
	foreignKey({
			columns: [table.addedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_added_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.approvedByProfileId],
			foreignColumns: [profiles.id],
			name: "books_approved_by_profile_id_fkey"
		}).onDelete("set null"),
	unique("books_isbn_13_key").on(table.isbn13),
	pgPolicy("Coaches and admins can delete books", { as: "permissive", for: "delete", to: ["public"], using: sql`is_coach_or_admin()` }),
	pgPolicy("Coaches and admins can update books", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Authenticated users can add books", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view all books", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("books_suggested_points_check", sql`(suggested_points >= 0) AND (suggested_points <= 3)`),
	check("books_book_points_check", sql`(book_points >= (0)::numeric) AND (book_points <= (3)::numeric)`),
]);

export const essayVotes = pgTable("essay_votes", {
	essayId: uuid("essay_id").notNull(),
	voterProfileId: uuid("voter_profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("essay_votes_voter_idx").using("btree", table.voterProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_votes_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.voterProfileId],
			foreignColumns: [profiles.id],
			name: "essay_votes_voter_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can vote (not own essays)", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((voter_profile_id = current_profile_id()) AND (NOT (essay_id IN ( SELECT essays.id
   FROM essays
  WHERE (essays.author_profile_id = current_profile_id())))))`  }),
	pgPolicy("Authenticated users can view votes", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can remove own votes", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const teamReadingLists = pgTable("team_reading_lists", {
	id: uuid().defaultRandom().notNull(),
	teamId: uuid("team_id").notNull(),
	title: text().notNull(),
	month: text(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("team_reading_lists_team_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_reading_lists_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "team_reading_lists_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Team members can delete their lists", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(team_id = ( SELECT profiles.team_id
   FROM profiles
  WHERE (profiles.id = current_profile_id())))` }),
	pgPolicy("Team members can create lists", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated users can view team lists", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Team members can update their lists", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const teamReadingListBooks = pgTable("team_reading_list_books", {
	listId: uuid("list_id").notNull(),
	bookId: uuid("book_id").notNull(),
	position: smallint().default(0).notNull(),
	note: text(),
}, (table) => [
	index("team_reading_list_books_list_idx").using("btree", table.listId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.listId],
			foreignColumns: [teamReadingLists.id],
			name: "team_reading_list_books_list_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.bookId],
			foreignColumns: [books.id],
			name: "team_reading_list_books_book_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Authenticated users can view list books", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Team members can remove list books", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Team members can manage list books", { as: "permissive", for: "insert", to: ["authenticated"] }),
]);

export const essayCoachReads = pgTable("essay_coach_reads", {
	essayId: uuid("essay_id").notNull(),
	coachProfileId: uuid("coach_profile_id").notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("essay_coach_reads_coach_idx").using("btree", table.coachProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_coach_reads_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.coachProfileId],
			foreignColumns: [profiles.id],
			name: "essay_coach_reads_coach_profile_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Coaches remove own reads", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(coach_profile_id = current_profile_id())` }),
	pgPolicy("Coaches mark own reads within their team", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Coach sees own reads; author sees reads of own essays", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	googleEmail: text("google_email").notNull(),
	suggestedWorkEmail: text("suggested_work_email"),
	verifiedWorkEmail: text("verified_work_email"),
	verifiedWorkEmailAt: timestamp("verified_work_email_at", { withTimezone: true, mode: 'string' }),
	googleProfilePicture: text("google_profile_picture"),
	googleFullName: text("google_full_name"),
	lastOtpSentAt: timestamp("last_otp_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("users_google_email_idx").using("btree", table.googleEmail.asc().nullsLast().op("text_ops")),
	index("users_suggested_work_email_idx").using("btree", table.suggestedWorkEmail.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authUserId],
			foreignColumns: [table.id],
			name: "users_auth_user_id_fkey"
		}).onDelete("cascade"),
	unique("users_auth_user_id_key").on(table.authUserId),
	unique("users_google_email_key").on(table.googleEmail),
	pgPolicy("Users can update only suggested_work_email", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(( SELECT auth.uid() AS uid) = auth_user_id)`, withCheck: sql`(( SELECT auth.uid() AS uid) = auth_user_id)`  }),
	pgPolicy("Users can insert their own user record", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can view their own user record", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	name: text().notNull(),
	description: text(),
	availableDays: integer("available_days").array(),
	canHaveTs: boolean("can_have_ts").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rooms_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	unique("rooms_code_key").on(table.code),
	pgPolicy("Admins can manage rooms", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role))))`  }),
	pgPolicy("Authenticated can read rooms", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const recurringSchedules = pgTable("recurring_schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	teamId: uuid("team_id").notNull(),
	createdBy: uuid("created_by"),
	dayOfWeek: integer("day_of_week").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	validFrom: date("valid_from").notNull(),
	validUntil: date("valid_until").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_recurring_schedules_day").using("btree", table.dayOfWeek.asc().nullsLast().op("int4_ops")),
	index("idx_recurring_schedules_room").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")),
	index("idx_recurring_schedules_team").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	index("idx_recurring_schedules_valid").using("btree", table.validFrom.asc().nullsLast().op("date_ops"), table.validUntil.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "recurring_schedules_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "recurring_schedules_team_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "recurring_schedules_created_by_fkey"
		}).onDelete("set null"),
	pgPolicy("Coaches can manage recurring_schedules", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`  }),
	pgPolicy("Authenticated can read recurring_schedules", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("recurring_schedules_day_of_week_check", sql`(day_of_week >= 0) AND (day_of_week <= 6)`),
	check("valid_time_range", sql`end_time > start_time`),
	check("valid_schedule_dates", sql`valid_until >= valid_from`),
]);

export const coworkParticipants = pgTable("cowork_participants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	reservationId: uuid("reservation_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_cowork_reservation").using("btree", table.reservationId.asc().nullsLast().op("uuid_ops")),
	index("idx_cowork_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.reservationId],
			foreignColumns: [reservations.id],
			name: "cowork_participants_reservation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "cowork_participants_user_id_fkey"
		}).onDelete("cascade"),
	unique("cowork_participants_reservation_id_user_id_key").on(table.reservationId, table.userId),
	pgPolicy("Users can join cowork", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((user_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))))) AND (EXISTS ( SELECT 1
   FROM reservations
  WHERE ((reservations.id = cowork_participants.reservation_id) AND (reservations.is_cowork_open = true)))))`  }),
	pgPolicy("Users can leave cowork", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Authenticated can read cowork_participants", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const roomIssues = pgTable("room_issues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	reportedBy: uuid("reported_by"),
	issueType: issueType("issue_type").notNull(),
	description: text(),
	status: issueStatus().default('open').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
}, (table) => [
	index("idx_room_issues_room_status").using("btree", table.roomId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_room_issues_type").using("btree", table.issueType.asc().nullsLast().op("enum_ops")).where(sql`(status = 'open'::issue_status)`),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "room_issues_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reportedBy],
			foreignColumns: [profiles.id],
			name: "room_issues_reported_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [profiles.id],
			name: "room_issues_resolved_by_fkey"
		}).onDelete("set null"),
	pgPolicy("Coaches can resolve issues", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))` }),
	pgPolicy("Users can update own issues", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can report issues", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Authenticated can read room_issues", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const scheduleBreaks = pgTable("schedule_breaks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	breakType: scheduleBreakType("break_type").notNull(),
	name: text().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_schedule_breaks_dates").using("btree", table.startDate.asc().nullsLast().op("date_ops"), table.endDate.asc().nullsLast().op("date_ops")),
	index("idx_schedule_breaks_type").using("btree", table.breakType.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "schedule_breaks_created_by_fkey"
		}).onDelete("set null"),
	pgPolicy("Coaches can manage schedule_breaks", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`  }),
	pgPolicy("Authenticated can read schedule_breaks", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("valid_break_date_range", sql`end_date >= start_date`),
]);

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	picture: text(),
	color: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	year: integer(),
}, (table) => [
	pgPolicy("Authenticated users can read teams", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const reservations = pgTable("reservations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	userId: uuid("user_id"),
	teamId: uuid("team_id"),
	recurringScheduleId: uuid("recurring_schedule_id"),
	reservationType: reservationType("reservation_type").default('personal').notNull(),
	title: text().notNull(),
	personCount: integer("person_count"),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }).notNull(),
	isCoworkOpen: boolean("is_cowork_open").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_reservations_recurring").using("btree", table.recurringScheduleId.asc().nullsLast().op("uuid_ops")),
	index("idx_reservations_room_time").using("btree", table.roomId.asc().nullsLast().op("timestamptz_ops"), table.startTime.asc().nullsLast().op("timestamptz_ops"), table.endTime.asc().nullsLast().op("timestamptz_ops")),
	index("idx_reservations_start").using("btree", table.startTime.asc().nullsLast().op("timestamptz_ops")),
	index("idx_reservations_team").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	index("idx_reservations_type").using("btree", table.reservationType.asc().nullsLast().op("enum_ops")),
	index("idx_reservations_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "reservations_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "reservations_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "reservations_team_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.recurringScheduleId],
			foreignColumns: [recurringSchedules.id],
			name: "reservations_recurring_schedule_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Coaches can manage TS reservations", { as: "permissive", for: "all", to: ["authenticated"], using: sql`((reservation_type = ANY (ARRAY['training_session'::reservation_type, 'houston_calling'::reservation_type])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))))`, withCheck: sql`((reservation_type = ANY (ARRAY['training_session'::reservation_type, 'houston_calling'::reservation_type])) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role]))))))`  }),
	pgPolicy("Authenticated can read reservations", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can delete own reservations", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("Users can update own reservations", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can create own reservations", { as: "permissive", for: "insert", to: ["authenticated"] }),
	check("valid_reservation_time", sql`end_time > start_time`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	picture: text(),
	userId: uuid("user_id"),
	workEmail: text("work_email").notNull(),
	role: profileRole().default('student').notNull(),
	teamId: uuid("team_id"),
	phoneNumber: text("phone_number"),
	personalEmail: text("personal_email"),
	dateOfBirth: date("date_of_birth"),
	removedAccess: timestamp("removed_access", { withTimezone: true, mode: 'string' }),
	removedAccessBy: uuid("removed_access_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("profiles_team_id_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	index("profiles_team_id_user_id_idx").using("btree", table.teamId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("profiles_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("profiles_work_email_idx").using("btree", table.workEmail.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "profiles_team_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.removedAccessBy],
			foreignColumns: [table.id],
			name: "profiles_removed_access_by_fkey"
		}).onDelete("set null"),
	unique("profiles_user_id_key").on(table.userId),
	unique("profiles_work_email_key").on(table.workEmail),
	pgPolicy("Verified users can view all profiles", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((removed_access IS NULL) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.auth_user_id = ( SELECT auth.uid() AS uid)) AND (users.verified_work_email IS NOT NULL)))))` }),
	pgPolicy("Users can update their own profile picture", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("valid_czu_domain", sql`(work_email ~~ '%@studenti.czu.cz'::text) OR (work_email ~~ '%@pef.czu.cz'::text)`),
]);

export const essayViews = pgTable("essay_views", {
	essayId: uuid("essay_id").notNull(),
	viewerProfileId: uuid("viewer_profile_id").notNull(),
	firstViewedAt: timestamp("first_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("essay_views_viewer_idx").using("btree", table.viewerProfileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.essayId],
			foreignColumns: [essays.id],
			name: "essay_views_essay_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.viewerProfileId],
			foreignColumns: [profiles.id],
			name: "essay_views_viewer_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.essayId, table.viewerProfileId], name: "essay_views_pkey"}),
	pgPolicy("No direct inserts to essay_views", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`false`  }),
	pgPolicy("Authors see all viewers; others see own row", { as: "permissive", for: "select", to: ["authenticated"] }),
]);
export const booksWithEssayCount = pgView("books_with_essay_count", {	id: uuid(),
	title: text(),
	author: text(),
	isbn13: text("isbn_13"),
	description: text(),
	coverPath: text("cover_path"),
	tags: text(),
	suggestedPoints: smallint("suggested_points"),
	bookPoints: numeric("book_points", { precision: 5, scale:  2 }),
	status: bookStatus(),
	addedByProfileId: uuid("added_by_profile_id"),
	approvedByProfileId: uuid("approved_by_profile_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	source: bookSource(),
	externalId: text("external_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	pageCount: integer("page_count"),
	previewLink: text("preview_link"),
	aiBookPoints: smallint("ai_book_points"),
	legacyBookPoints: numeric("legacy_book_points", { precision: 5, scale:  2 }),
	aiReason: text("ai_reason"),
	essayCount: integer("essay_count"),
}).as(sql`SELECT b.id, b.title, b.author, b.isbn_13, b.description, b.cover_path, b.tags, b.suggested_points, b.book_points, b.status, b.added_by_profile_id, b.approved_by_profile_id, b.approved_at, b.rejection_reason, b.source, b.external_id, b.created_at, b.updated_at, b.page_count, b.preview_link, b.ai_book_points, b.legacy_book_points, b.ai_reason, COALESCE(ec.essay_count, 0) AS essay_count FROM books b LEFT JOIN ( SELECT essays.book_id, count(*)::integer AS essay_count FROM essays WHERE essays.book_id IS NOT NULL GROUP BY essays.book_id) ec ON ec.book_id = b.id`);