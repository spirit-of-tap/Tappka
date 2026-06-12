import { relations } from "drizzle-orm/relations";
import { profiles, dashboardLayouts, essays, essayComments, books, bookComments, essayVotes, teams, teamReadingLists, teamReadingListBooks, essayCoachReads, usersInAuth, users, rooms, recurringSchedules, reservations, coworkParticipants, roomIssues, scheduleBreaks, essayViews } from "./schema";

export const dashboardLayoutsRelations = relations(dashboardLayouts, ({one}) => ({
	profile: one(profiles, {
		fields: [dashboardLayouts.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	dashboardLayouts: many(dashboardLayouts),
	essayComments: many(essayComments),
	bookComments: many(bookComments),
	essays: many(essays),
	books_addedByProfileId: many(books, {
		relationName: "books_addedByProfileId_profiles_id"
	}),
	books_approvedByProfileId: many(books, {
		relationName: "books_approvedByProfileId_profiles_id"
	}),
	essayVotes: many(essayVotes),
	teamReadingLists: many(teamReadingLists),
	essayCoachReads: many(essayCoachReads),
	recurringSchedules: many(recurringSchedules),
	coworkParticipants: many(coworkParticipants),
	roomIssues_reportedBy: many(roomIssues, {
		relationName: "roomIssues_reportedBy_profiles_id"
	}),
	roomIssues_resolvedBy: many(roomIssues, {
		relationName: "roomIssues_resolvedBy_profiles_id"
	}),
	scheduleBreaks: many(scheduleBreaks),
	reservations: many(reservations),
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	team: one(teams, {
		fields: [profiles.teamId],
		references: [teams.id]
	}),
	profile: one(profiles, {
		fields: [profiles.removedAccessBy],
		references: [profiles.id],
		relationName: "profiles_removedAccessBy_profiles_id"
	}),
	profiles: many(profiles, {
		relationName: "profiles_removedAccessBy_profiles_id"
	}),
	essayViews: many(essayViews),
}));

export const essayCommentsRelations = relations(essayComments, ({one}) => ({
	essay: one(essays, {
		fields: [essayComments.essayId],
		references: [essays.id]
	}),
	profile: one(profiles, {
		fields: [essayComments.authorProfileId],
		references: [profiles.id]
	}),
}));

export const essaysRelations = relations(essays, ({one, many}) => ({
	essayComments: many(essayComments),
	profile: one(profiles, {
		fields: [essays.authorProfileId],
		references: [profiles.id]
	}),
	book: one(books, {
		fields: [essays.bookId],
		references: [books.id]
	}),
	essayVotes: many(essayVotes),
	essayCoachReads: many(essayCoachReads),
	essayViews: many(essayViews),
}));

export const bookCommentsRelations = relations(bookComments, ({one}) => ({
	book: one(books, {
		fields: [bookComments.bookId],
		references: [books.id]
	}),
	profile: one(profiles, {
		fields: [bookComments.authorProfileId],
		references: [profiles.id]
	}),
}));

export const booksRelations = relations(books, ({one, many}) => ({
	bookComments: many(bookComments),
	essays: many(essays),
	profile_addedByProfileId: one(profiles, {
		fields: [books.addedByProfileId],
		references: [profiles.id],
		relationName: "books_addedByProfileId_profiles_id"
	}),
	profile_approvedByProfileId: one(profiles, {
		fields: [books.approvedByProfileId],
		references: [profiles.id],
		relationName: "books_approvedByProfileId_profiles_id"
	}),
	teamReadingListBooks: many(teamReadingListBooks),
}));

export const essayVotesRelations = relations(essayVotes, ({one}) => ({
	essay: one(essays, {
		fields: [essayVotes.essayId],
		references: [essays.id]
	}),
	profile: one(profiles, {
		fields: [essayVotes.voterProfileId],
		references: [profiles.id]
	}),
}));

export const teamReadingListsRelations = relations(teamReadingLists, ({one, many}) => ({
	team: one(teams, {
		fields: [teamReadingLists.teamId],
		references: [teams.id]
	}),
	profile: one(profiles, {
		fields: [teamReadingLists.createdByProfileId],
		references: [profiles.id]
	}),
	teamReadingListBooks: many(teamReadingListBooks),
}));

export const teamsRelations = relations(teams, ({many}) => ({
	teamReadingLists: many(teamReadingLists),
	recurringSchedules: many(recurringSchedules),
	reservations: many(reservations),
	profiles: many(profiles),
}));

export const teamReadingListBooksRelations = relations(teamReadingListBooks, ({one}) => ({
	teamReadingList: one(teamReadingLists, {
		fields: [teamReadingListBooks.listId],
		references: [teamReadingLists.id]
	}),
	book: one(books, {
		fields: [teamReadingListBooks.bookId],
		references: [books.id]
	}),
}));

export const essayCoachReadsRelations = relations(essayCoachReads, ({one}) => ({
	essay: one(essays, {
		fields: [essayCoachReads.essayId],
		references: [essays.id]
	}),
	profile: one(profiles, {
		fields: [essayCoachReads.coachProfileId],
		references: [profiles.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [users.authUserId],
		references: [usersInAuth.id]
	}),
	profiles: many(profiles),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	users: many(users),
}));

export const recurringSchedulesRelations = relations(recurringSchedules, ({one, many}) => ({
	room: one(rooms, {
		fields: [recurringSchedules.roomId],
		references: [rooms.id]
	}),
	team: one(teams, {
		fields: [recurringSchedules.teamId],
		references: [teams.id]
	}),
	profile: one(profiles, {
		fields: [recurringSchedules.createdBy],
		references: [profiles.id]
	}),
	reservations: many(reservations),
}));

export const roomsRelations = relations(rooms, ({many}) => ({
	recurringSchedules: many(recurringSchedules),
	roomIssues: many(roomIssues),
	reservations: many(reservations),
}));

export const coworkParticipantsRelations = relations(coworkParticipants, ({one}) => ({
	reservation: one(reservations, {
		fields: [coworkParticipants.reservationId],
		references: [reservations.id]
	}),
	profile: one(profiles, {
		fields: [coworkParticipants.userId],
		references: [profiles.id]
	}),
}));

export const reservationsRelations = relations(reservations, ({one, many}) => ({
	coworkParticipants: many(coworkParticipants),
	room: one(rooms, {
		fields: [reservations.roomId],
		references: [rooms.id]
	}),
	profile: one(profiles, {
		fields: [reservations.userId],
		references: [profiles.id]
	}),
	team: one(teams, {
		fields: [reservations.teamId],
		references: [teams.id]
	}),
	recurringSchedule: one(recurringSchedules, {
		fields: [reservations.recurringScheduleId],
		references: [recurringSchedules.id]
	}),
}));

export const roomIssuesRelations = relations(roomIssues, ({one}) => ({
	room: one(rooms, {
		fields: [roomIssues.roomId],
		references: [rooms.id]
	}),
	profile_reportedBy: one(profiles, {
		fields: [roomIssues.reportedBy],
		references: [profiles.id],
		relationName: "roomIssues_reportedBy_profiles_id"
	}),
	profile_resolvedBy: one(profiles, {
		fields: [roomIssues.resolvedBy],
		references: [profiles.id],
		relationName: "roomIssues_resolvedBy_profiles_id"
	}),
}));

export const scheduleBreaksRelations = relations(scheduleBreaks, ({one}) => ({
	profile: one(profiles, {
		fields: [scheduleBreaks.createdBy],
		references: [profiles.id]
	}),
}));

export const essayViewsRelations = relations(essayViews, ({one}) => ({
	essay: one(essays, {
		fields: [essayViews.essayId],
		references: [essays.id]
	}),
	profile: one(profiles, {
		fields: [essayViews.viewerProfileId],
		references: [profiles.id]
	}),
}));