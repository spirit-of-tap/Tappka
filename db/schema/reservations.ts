// Schema source of truth (drizzle-kit only; NOT imported at runtime — app uses supabase-js).
// Please look at CONTRIBUTING.md for more information on how to change the schema.
import { pgTable, foreignKey, pgPolicy, uuid, text, integer, smallint, timestamp, index, unique, check, time, date, pgEnum, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { profiles } from "./profiles"
import { teams } from "./teams"

export const scheduleType = pgEnum("schedule_type", ['training_session', 'houston_calling'])

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	name: text().notNull(),
	description: text(),
	availableDays: integer("available_days").array(),
	canHaveTs: boolean("can_have_ts").default(true).notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("idx_rooms_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	unique("rooms_code_key").on(table.code),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "rooms_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "rooms_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Admins can manage rooms", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = 'admin'::profile_role))))`  }),
	pgPolicy("Authenticated can read rooms", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]).enableRLS();

export const recurringSchedules = pgTable("recurring_schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	teamId: uuid("team_id"),
	scheduleType: scheduleType("schedule_type").notNull(),
	dayOfWeek: smallint("day_of_week").notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	validFrom: date("valid_from").notNull(),
	validUntil: date("valid_until"),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("idx_recurring_schedules_day").using("btree", table.dayOfWeek.asc().nullsLast().op("int2_ops")),
	index("idx_recurring_schedules_room").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")),
	index("idx_recurring_schedules_team").using("btree", table.teamId.asc().nullsLast().op("uuid_ops")),
	index("idx_recurring_schedules_type").using("btree", table.scheduleType.asc().nullsLast().op("enum_ops")),
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
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "recurring_schedules_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "recurring_schedules_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Coaches can manage recurring_schedules", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`  }),
	pgPolicy("Authenticated can read recurring_schedules", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("recurring_schedules_day_of_week_check", sql`(day_of_week >= 0) AND (day_of_week <= 6)`),
	check("valid_time_range", sql`end_time > start_time`),
	check("valid_schedule_dates", sql`(valid_until IS NULL) OR (valid_until >= valid_from)`),
	check("recurring_schedules_team_for_ts", sql`(schedule_type <> 'training_session'::schedule_type) OR (team_id IS NOT NULL)`),
]).enableRLS();

export const reservations = pgTable("reservations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	ownerProfileId: uuid("owner_profile_id"),
	title: text().notNull(),
	personCount: integer("person_count"),
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).notNull(),
	endAt: timestamp("end_at", { withTimezone: true, mode: 'string' }).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancelledByProfileId: uuid("cancelled_by_profile_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("idx_reservations_room_time").using("btree", table.roomId.asc().nullsLast().op("uuid_ops"), table.startAt.asc().nullsLast().op("timestamptz_ops"), table.endAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_reservations_start").using("btree", table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_reservations_owner").using("btree", table.ownerProfileId.asc().nullsLast().op("uuid_ops")),
	// Drizzle cannot express EXCLUDE constraints. This GiST index is the
	// schema-level stand-in for:
	//   CONSTRAINT no_overlap EXCLUDE USING gist (
	//     room_id WITH =, tstzrange(start_at, end_at) WITH &&
	//   )
	// Migrations must create the EXCLUDE constraint (not a plain index).
	index("no_overlap").using(
		"gist",
		table.roomId.asc().nullsLast().op("uuid_ops"),
		sql`tstzrange(${table.startAt}, ${table.endAt})`,
	),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "reservations_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ownerProfileId],
			foreignColumns: [profiles.id],
			name: "reservations_owner_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.cancelledByProfileId],
			foreignColumns: [profiles.id],
			name: "reservations_cancelled_by_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "reservations_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "reservations_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Authenticated can read reservations", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Users can delete own reservations", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`(owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))))` }),
	pgPolicy("Users can update own reservations", { as: "permissive", for: "update", to: ["authenticated"], using: sql`(owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))))`, withCheck: sql`(owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))))` }),
	pgPolicy("Users can create own reservations", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`(owner_profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid))))))` }),
	check("valid_reservation_time", sql`end_at > start_at`),
]).enableRLS();

export const scheduleBreaks = pgTable("schedule_breaks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdByProfileId: uuid("created_by_profile_id").notNull(),
	updatedByProfileId: uuid("updated_by_profile_id").notNull(),
}, (table) => [
	index("idx_schedule_breaks_dates").using("btree", table.startDate.asc().nullsLast().op("date_ops"), table.endDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.createdByProfileId],
			foreignColumns: [profiles.id],
			name: "schedule_breaks_created_by_profile_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.updatedByProfileId],
			foreignColumns: [profiles.id],
			name: "schedule_breaks_updated_by_profile_id_fkey"
		}).onDelete("restrict"),
	pgPolicy("Coaches can manage schedule_breaks", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id IN ( SELECT users.id
           FROM users
          WHERE (users.auth_user_id = ( SELECT auth.uid() AS uid)))) AND (profiles.role = ANY (ARRAY['coach'::profile_role, 'admin'::profile_role])))))`  }),
	pgPolicy("Authenticated can read schedule_breaks", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("valid_break_date_range", sql`end_date >= start_date`),
]).enableRLS();
