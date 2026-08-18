# Birth Giving Events Design

**Date:** 2026-08-19  
**Issue:** [#54](https://github.com/spirit-of-tap/Tappka/issues/54)  
**Status:** Validated

## Purpose

The legacy `individualni.xlsx` portfolio stores a Birth Giving (BG) row for each participating student. Customer, date, duration, assignment, and result are consequently copied into multiple portfolios even though they describe shared work.

Tappka will model BG as a canonical community event. An event has one shared assignment and one or more temporary BG teams. Each team has its own shared result, while each participant records one individual reflection covering personal contribution and learning. People can also discover upcoming events and, when joining is open, create or join a temporary team.

Temporary BG teams are unrelated to the long-lived school teams in the existing `teams` table. Every organizer and participant must be an existing profile.

## Goals

- Store event-level information once rather than once per participant.
- Store each temporary team's result once rather than once per team member.
- Let each participant record one individual contribution and learning reflection.
- Support both upcoming events and historical data entry.
- Make all BG events discoverable to the verified community.
- Let organizers choose whether an event accepts new participants.
- Let people create or join temporary teams in open events.
- Prevent duplicate event records at both the UI and database layers.
- Derive profile BG history from canonical event participation.

## Non-Goals

The first version will not include:

- idea voting or approval workflows;
- idea lifecycle or project conversion;
- presentation templates;
- comments or notifications;
- file attachments;
- automatic Excel import;
- a separate RSVP or attendance model; or
- rich-text editing.

Joining a temporary team represents sign-up and participation in the first version. If real usage shows that sign-up and attendance differ, attendance can be modeled separately later.

## Data Model

### Birth Giving events

`birth_giving_events` is the canonical root record and contains:

- required human-readable event name;
- required customer;
- required start date and time;
- required duration in minutes;
- required shared assignment;
- `joining_open`;
- soft-delete timestamps; and
- creation and update audit fields.

The event does not contain a result or an individual reflection.

### Organizers

`birth_giving_event_organizers` links one or more existing profiles to an event. Organizer authority is explicit and independent of the profile that inserted the row. Named organizers edit event-level fields, control joining, manage temporary team structure, and manage memberships.

### Temporary teams

`birth_giving_teams` belongs to one BG event and contains:

- a required team name;
- the team's shared, nullable result;
- soft-delete timestamps; and
- creation and update audit fields.

It has no relationship to the existing `teams` table. Only current members of a temporary team may edit that team's result. A named organizer has no special result-editing permission unless the organizer is also a member of that team.

### Memberships

`birth_giving_team_members` links an existing profile to a temporary team. It also carries the event ID so database constraints can:

- prevent a team from being used with the wrong event; and
- allow a profile to belong to at most one temporary team per event.

An event must always have at least one temporary team, and each temporary team must always have at least one member. Creation and membership operations must preserve these invariants atomically.

### Individual reflections

`birth_giving_reflections` stores at most one combined personal contribution and learning reflection per event participant. Its identity is event plus profile, not membership ID, so moving between temporary teams does not discard the reflection. A foreign key to event membership prevents reflections by non-participants.

The reflection is personal in ownership, not private in visibility. Only its profile owner may edit it, while all verified community members may read it.

## Permissions

| Capability | Verified community | Event organizer | Team member | Reflection owner |
| --- | --- | --- | --- | --- |
| View event, assignment, teams, results, and reflections | Yes | Yes | Yes | Yes |
| Edit shared event details and joining state | No | Yes | No | No |
| Create or join a team while joining is open | Yes | Yes | Yes | Yes |
| Add, move, or remove profiles for historical reconstruction | No | Yes | No | No |
| Edit a team's shared result | No | Only when also a member | Yes, own team | Only when also a member |
| Edit an individual reflection | No | No | No | Yes, own reflection |

All tables use RLS. Mutation authorization must be enforced in PostgreSQL rather than relying on hidden UI controls.

## Lifecycle

An event may be created with a future or past start time. Creation requires event details, at least one named organizer, and a first temporary team with a first existing profile. The operation must be atomic so a partial event cannot become visible.

Historical events default to closed joining. Upcoming events require an explicit joining choice. Date and time do not automatically open or close joining: named organizers retain manual control because registration may close early or reopen later.

When joining is open, a profile not yet participating may:

- create a new temporary team and become its first member; or
- join an existing temporary team.

Participants may leave or switch teams while joining remains open. Named organizers may add, move, or remove profiles at any time for event management and historical reconstruction. No operation may leave a temporary team empty or leave an event without a team.

## Duplicate Prevention

Duplicate prevention addresses both repeated shared fields and multiple event records representing the same real event.

Normalization removes per-person and per-team-member copies by storing shared event data on the event and shared team results on the temporary team.

Before event creation, the server searches a defined date window for similar normalized event names and customers. Candidate events are shown with direct links so the person can use the existing canonical record. Creation can continue only after explicit confirmation that no candidate is the same real event.

A database unique index over normalized exact event name, normalized exact customer, and start time prevents exact and concurrent duplicate inserts. Separate events at the same customer and time must have distinguishable names. A unique-constraint race returns the existing canonical event rather than a generic error.

Fuzzy matching cannot prove real-world identity, so it remains a guided creation gate rather than the only database guarantee. A merge tool is not part of the first version.

## User Experience

BG requires a dedicated event index because community members actively search for events to join. It should not exist only as a profile card. The older navigation decision in `2026-07-01-navigation-architecture.md` is superseded for Birth Giving by this requirement.

The index provides:

- `Nadcházející` for upcoming events, with open events first;
- `Moje` for events where the current profile organizes or participates;
- `Historie` for past events; and
- search by event name and customer.

Event cards show name, customer, date and time, joining state, team count, and participant count.

The event detail page is the canonical collaboration surface. It shows shared event information and assignment once, followed by temporary teams, members, each team's result, and individual reflections. Available actions depend on RLS-backed permissions and joining state.

Profile pages derive a person's BG history from memberships and link to canonical event details. They do not copy customer, assignment, team result, or reflection content into another record.

## Error Handling

Expected conflicts should refresh and present the canonical server state:

- joining closed after the page loaded;
- profile already belongs to another team in the event;
- event already exists;
- team membership changed concurrently; and
- an operation would leave a team or event without a required team/member.

Atomic database operations are required for event creation, team creation with first membership, joining, switching teams, and organizer-managed membership changes.

## Testing

### Integration

- Event creation inserts the event, organizer, first team, and first member atomically.
- A profile cannot belong to two temporary teams in one event.
- A team membership cannot cross event boundaries.
- Exact event identity cannot be inserted twice.
- Failed operations leave no partial records.
- RLS permits verified community reads.
- RLS limits event updates to named organizers.
- RLS limits team result updates to that team's members.
- RLS limits reflection updates to the reflection owner.
- Team and event membership invariants survive leave, switch, and organizer management operations.

### Unit And Component

- Event identity normalization and near-duplicate candidate ranking.
- Upcoming, personal, and historical event grouping.
- Join and create-team action availability.
- Duplicate warnings, validation, and expected conflict states.

### End To End

- Create an open upcoming event with its first team.
- Join an existing team and create another team from another profile.
- Reject duplicate event membership.
- Close joining and reject subsequent self-service joining.
- Record different results for different teams.
- Record and community-read individual reflections.
- Show canonical event participation from a profile page.
- Create a historical event and add existing profiles directly.

## Implementation Note

The schema source of truth is `db/schema/*.ts`. Atomic multi-table operations and invariant enforcement may require database functions or deferred constraint triggers that Drizzle cannot model. If so, they must follow the repository's custom migration workflow while the tables, indexes, foreign keys, and RLS policies remain represented in the Drizzle schema where supported.
