import { pgTable, foreignKey, pgPolicy, uuid, text, integer, boolean, timestamp, index, unique, check, time, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { teams } from "./teams"

export const issueStatus = pgEnum("issue_status", ['open', 'resolved'])
export const issueType = pgEnum("issue_type", ['locked', 'mess', 'technical', 'other'])
export const reservationType = pgEnum("reservation_type", ['personal', 'training_session', 'houston_calling'])
export const scheduleBreakType = pgEnum("schedule_break_type", ['days_of_joy', 'holiday', 'other'])

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
