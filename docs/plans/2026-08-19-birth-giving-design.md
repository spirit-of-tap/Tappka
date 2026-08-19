# Birth Giving Events Design

**Date:** 2026-08-19  
**Issue:** [#54](https://github.com/spirit-of-tap/Tappka/issues/54)  
**Status:** Validated

## Purpose

The legacy `individualni.xlsx` portfolio stores a Birth Giving (BG) row for each participating student. Customer, date, duration, assignment, and result are consequently copied into multiple portfolios even though they describe shared work.

Tappka will model BG as a canonical community event. An event has one shared assignment document and one or more temporary BG teams. Each team has its own collection of result documents, while each participant records one individual reflection covering personal contribution and learning. People can discover upcoming events and form temporary teams through mutually approved requests and invitations.

Temporary BG teams are unrelated to the long-lived school teams in the existing `teams` table. Every organizer and participant must be an existing profile.

## Goals

- Store event-level information once rather than once per participant.
- Store each temporary team's results once rather than once per team member.
- Let each participant record one individual contribution and learning reflection.
- Support both upcoming events and complete retrospective data entry.
- Make all published BG events discoverable to the verified community.
- Let organizers decide whether an upcoming event accepts team formation before it starts.
- Require mutual consent before a person joins an existing temporary team.
- Enforce event-wide minimum and maximum team sizes.
- Release the assignment document only when the BG starts.
- Preserve assignment and result files inside Tappka instead of depending on revocable external links.
- Prevent duplicate event records at both the UI and database layers.
- Derive profile BG counts and history from canonical event participation.

## Non-Goals

The first version will not include:

- idea voting or approval workflows;
- idea lifecycle or project conversion;
- presentation templates;
- comments or in-app notifications;
- automatic Excel import;
- a separate RSVP or attendance model; or
- rich-text editing.

Confirmed membership in a valid temporary team represents participation. If real usage shows that team membership and actual attendance differ, attendance can be modeled separately later.

## Core Data Model

### Birth Giving events

`birth_giving_events` is the canonical root record and contains:

- required human-readable event name;
- required customer;
- required start date and time (`starts_at`);
- required duration type (`8h` or `24h`);
- event-wide minimum and maximum temporary team sizes;
- manually controlled `joining_open`;
- lifecycle status (`draft` or `published`);
- start-processing and email audit timestamps;
- soft-delete timestamps; and
- creation and update audit fields.

The end time is derived from `starts_at` and the duration type. Team formation always closes at `starts_at`, even if `joining_open` was not closed manually.

Draft events are visible only to their named organizers. They do not appear in discovery, profiles, or BG counts. A draft reserves the event identity so a multi-step retrospective entry cannot accidentally be created twice.

### Organizers

`birth_giving_event_organizers` links one or more existing profiles to an event. Organizer authority is explicit and independent of the profile that inserted the event row.

Named organizers may:

- edit event-level fields before the event ends;
- control joining before the event starts;
- upload and replace the assignment document until the event ends;
- manage temporary team structure and membership for retrospective entry or correction; and
- upload team result documents for historical events.

### Assignment document

The event has at most one current assignment document. Its metadata contains:

- storage path in the private `documents` bucket;
- original file name;
- MIME type;
- file size; and
- upload and audit fields.

Organizers may upload it before the event or replace it until the derived end time. Replacement stores the new object and metadata successfully before removing the old object and metadata. The old assignment is not retained as a version. Replacement during an active BG immediately emails confirmed members of valid teams with a link to the event. The assignment is locked after the event ends.

For a historical event whose assignment cannot be recovered, an explicit `missing` state replaces the file. This state is distinct from an upload or loading error.

### Temporary teams

`birth_giving_teams` belongs to one BG event and contains:

- a required team name;
- formation/cancellation status;
- cancellation reason and timestamp; and
- creation and update audit fields.

It has no relationship to the existing `teams` table. A team may remain below the event minimum while the event is forming, but it may never exceed the event maximum. Empty teams are removed automatically. At the event start, teams below the minimum are automatically cancelled without a warning email.

### Confirmed memberships

`birth_giving_team_members` links an existing profile to a temporary team and also carries the event ID so database constraints can:

- prevent a team from being used with the wrong event; and
- allow a profile to have at most one confirmed temporary team per event.

Only published, non-cancelled membership in a team that passed the start-time size validation counts as BG participation. Each such membership contributes exactly one BG to the participant's profile.

### Team formation proposals

Requests and invitations do not create participation. A proposal records:

- event and target team;
- candidate profile;
- initiating profile;
- direction (`join_request` or `invitation`);
- state (`pending`, `accepted`, `rejected`, `cancelled`, or `expired`);
- resolving profile and timestamp; and
- creation and update audit fields.

A person may have multiple pending proposals but only one confirmed membership. Accepting one proposal atomically creates or moves membership, cancels the person's other pending proposals, and clears their team-search status.

Any confirmed member of a team may approve an incoming join request or invite another profile. Only the invited profile may accept an invitation.

### Looking for a team

A separate event/profile record represents the public `Hledám tým` state. All verified community members may see this list. The state is cleared when the person joins or creates a team, switches it off, or team formation closes.

### Result documents

`birth_giving_team_result_files` stores any number of result files for a temporary team. Each row contains:

- team and event identity;
- storage path in the private `documents` bucket;
- original file name;
- MIME type;
- file size; and
- upload and audit fields.

Confirmed members may manage their own team's result files. Organizers may additionally upload result files for any team during retrospective entry. A historical team can explicitly record that its result could not be recovered; missing files do not prevent publication or participation counting.

### Individual reflections

`birth_giving_reflections` stores at most one combined personal contribution and learning reflection per event participant. Its identity is event plus profile, not membership ID, so an allowed pre-start move between teams does not discard it. A foreign key to confirmed membership prevents reflections by non-participants.

The reflection is personal in ownership, not private in visibility. Only its profile owner may edit it, while all verified community members may read it.

## Storage And File Integrity

Assignment and result files use the existing private `documents` bucket. Uploads use the existing presigned upload pattern, while reads use short-lived signed URLs produced only after server-side authorization.

The upload allowlist should cover common safe document, presentation, spreadsheet, PDF, and image formats, including PDF, PPTX, DOCX, XLSX, and common images. Executables and other unsafe file types remain forbidden. Limits for individual file size and total team result storage must be named constants.

External URLs are not accepted as substitutes for assignment or result files. Upload UI must explain why:

> Nahrajte exportovanou kopii souboru. Odkazy na Canvu, Google Drive a další služby mohou později ztratit přístup, takže nejsou spolehlivým výsledkem BG.

A URL embedded inside an uploaded document cannot be prevented, but Tappka always preserves the uploaded file itself as the source of truth.

The assignment download endpoint returns a signed URL to organizers at any time before the end and to the verified community only when `now >= starts_at`. Hiding the download button is not sufficient; the endpoint must enforce the time gate on every request.

## Permissions

| Capability | Verified community | Event organizer | Confirmed team member | Reflection owner |
| --- | --- | --- | --- | --- |
| View published event metadata, teams, results, and reflections | Yes | Yes | Yes | Yes |
| Open assignment before start | No | Yes | No | No |
| Open assignment from start onward | Yes | Yes | Yes | Yes |
| Edit event details and joining state | No | Yes | No | No |
| Upload or replace assignment before event end | No | Yes | No | No |
| Create a team while formation is open | Yes | Yes | Yes | Yes |
| Request, invite, approve, or accept as permitted | Yes | Yes | Yes | Yes |
| Add, move, or remove profiles for retrospective reconstruction | No | Yes | No | No |
| Manage a team's result files | No | Historical event only | Yes, own team | Only when also a member |
| Edit an individual reflection | No | No | No | Yes, own reflection |

All tables use RLS. Mutation authorization must be enforced in PostgreSQL and server routes rather than relying on hidden UI controls.

## Upcoming Event Lifecycle

An upcoming event begins as a private draft. Publishing requires event details, at least one named organizer, a valid minimum/maximum range, and an explicit joining choice. The assignment may be uploaded later, but the event clearly shows whether it is ready.

While joining is open and the start time has not arrived, a profile may:

- mark themselves as looking for a team;
- create a team and become its first confirmed member;
- request entry into an existing team;
- accept or reject an invitation;
- approve or reject a request as an existing team member; or
- request or accept a move to another team after acknowledging that the current team will be left.

All transitions re-check the event time, joining state, team capacity, proposal state, and current membership inside one transaction.

At `starts_at`, an idempotent scheduled operation performs this fixed sequence:

1. Close team formation.
2. Expire all pending requests and invitations.
3. Clear all `Hledám tým` states.
4. Cancel teams below the minimum size.
5. Freeze the remaining valid membership for participation counting.
6. Create one assignment-release email job per remaining confirmed member.

No warning email is sent before an undersized team is cancelled. Download authorization still checks `starts_at` directly, so assignment secrecy does not depend on the scheduler running at an exact instant.

## Email Delivery

The existing Resend integration sends emails. At the event start, each confirmed member of a valid team receives an email containing a link to the event in Tappka. The assignment is not attached because arbitrary documents may exceed email limits and the Tappka link always resolves to the current authorized file.

Replacing the assignment during the active 8- or 24-hour event immediately sends another email to the same valid membership set.

Email delivery must be retry-safe. A unique delivery record for event, profile, and message type prevents duplicate start emails. Assignment replacement messages also include a replacement identifier so retries deduplicate one replacement without suppressing a later replacement.

Upload UI tells organizers that the document stays hidden until the start and that confirmed teams will receive an email link.

## Retrospective Entry

Historical entry uses a resumable private draft because several teams and files cannot be uploaded safely in one HTTP request. The first step reserves the canonical event identity after duplicate checks. Autosaved steps do not affect profiles or BG counts.

The retrospective wizard has four steps:

1. `Event`: name, customer, start time, 8/24-hour duration, team size limits, and named organizers.
2. `Zadání`: upload the preserved assignment copy or mark it as not recovered.
3. `Týmy a výsledky`: create each real temporary team, select existing profiles, and upload any number of result files or mark a result as not recovered.
4. `Kontrola`: show duplicate candidates, validation issues, missing-document states, and the profiles whose BG count will increase.

Publishing performs one transactional validation and makes the canonical event visible. It requires:

- at least one temporary team;
- every team to satisfy the event minimum and maximum;
- every participant to reference an existing profile;
- no profile to appear in two teams; and
- explicit present-or-missing state for the assignment and each team's result.

Missing historical documents do not block publication. Individual reflections are not entered on behalf of other people; each participant may add their own reflection later.

## Duplicate Prevention

Duplicate prevention addresses both repeated shared fields and multiple event records representing the same real event.

Normalization removes per-person and per-team-member copies by storing shared event data on the event, assignment on its file record, and shared results on temporary teams.

Before draft creation, the server searches a defined date window for similar normalized event names and customers. Candidate events and drafts are shown with direct links. Creation can continue only after explicit confirmation that no candidate is the same real event.

A database unique index over normalized exact event name, normalized exact customer, and start time prevents exact and concurrent duplicate inserts. Separate events at the same customer and time must have distinguishable names. A unique-constraint race returns the existing canonical event rather than a generic error.

Fuzzy matching cannot prove real-world identity, so it remains a guided creation gate rather than the only database guarantee. A merge tool is not part of the first version.

## Discovery And Event Detail

BG requires a dedicated event index because the community actively searches for events and teams. It should not exist only as a profile card. The older navigation decision in `2026-07-01-navigation-architecture.md` is superseded for Birth Giving by this requirement.

The index provides:

- `Nadcházející` for upcoming events, with events open for team formation first;
- `Moje` for events where the current profile organizes, participates, or has a pending proposal;
- `Historie` for past events; and
- search by event name and customer.

Event cards show name, customer, start time, 8/24-hour type, joining state, team size range, team count, and confirmed participant count.

The event detail page is the canonical collaboration surface. It shows:

- shared event metadata and assignment release state;
- temporary teams, capacity, confirmed members, and pending requests;
- the public `Hledají tým` list;
- each valid team's result files or explicit missing state; and
- individual reflections.

Available actions depend on RLS-backed permissions, lifecycle, and current time.

Profile pages derive a person's BG count and history from valid published memberships and link to canonical event and team details. They do not copy customer, assignment, team result, or reflection content into another record.

## Error Handling

Expected conflicts return refreshed canonical state and a specific explanation:

- team formation closed after the page loaded;
- target team reached maximum capacity;
- request or invitation was already resolved;
- profile joined another team concurrently;
- a move would change or remove the previous team;
- assignment is not released yet or is locked after the event end;
- event already exists;
- historical draft fails publication validation; or
- an operation would violate the required event/team relationship.

Upload confirmation happens only after storage succeeds. Orphaned unconfirmed objects are cleaned up asynchronously. Assignment replacement stores the replacement first and removes the old object only after metadata switches successfully, so an upload failure never destroys the current assignment.

## Testing

### Integration

- Draft creation reserves identity but does not affect discovery or profile counts.
- Publication validates and exposes a historical event atomically.
- Missing historical assignment and result states can publish explicitly.
- A profile cannot have two confirmed teams in one event.
- A membership, proposal, result file, or reflection cannot cross event boundaries.
- Team capacity is re-checked during concurrent approvals and invitation acceptance.
- Only a team member can approve that team's request; only the invited profile can accept an invitation.
- Accepting a proposal atomically moves membership, clears team search, and cancels other proposals.
- Empty teams are removed and undersized teams are cancelled at start.
- Start processing is idempotent and each valid membership counts exactly once.
- Exact event identity cannot be inserted twice.
- RLS permits verified community reads and limits every mutation to its defined role.
- Assignment access is rejected immediately before `starts_at` and allowed at or after it.
- Assignment replacement is rejected after the event end.
- A team supports multiple result files.
- Historical organizers can upload result files for reconstructed teams.
- Failed operations leave no partial relational state.

### Unit And Component

- Event identity normalization and near-duplicate ranking.
- End-time calculation for 8- and 24-hour events.
- Upcoming, personal, and historical event grouping.
- Available actions for each lifecycle, time, and membership state.
- Start and replacement email recipient selection and idempotency keys.
- Retrospective wizard autosave, missing-file state, validation, and publication review.
- Safe file validation and external-link warning.
- Looking-for-team, request, invitation, move, capacity-race, and expected conflict states.

### End To End

- Create and publish an upcoming event with an assignment hidden before start.
- Mark a profile as looking for a team and send an invitation.
- Request entry and obtain approval from any existing team member.
- Move between teams and remove an emptied former team.
- Reject duplicate membership and a concurrent capacity overflow.
- Process event start, cancel an undersized team, and freeze valid participation.
- Open the assignment after start and record distinct result files for different teams.
- Replace assignment during the event and lock it after the end.
- Record and community-read individual reflections.
- Show the same canonical event and correct BG count on every participating profile.
- Create a historical draft, add all teams and existing profiles, upload multiple results, mark an unavailable document, and publish once.
- Retry start email processing without producing duplicate deliveries.

## Implementation Notes

The schema source of truth is `db/schema/*.ts`. Atomic multi-table transitions, publication, start processing, and invariant enforcement may require database functions or deferred constraint triggers that Drizzle cannot model. If so, they must follow the repository's custom migration workflow while tables, indexes, foreign keys, checks, and RLS policies remain represented in the Drizzle schema where supported.

Scheduled start processing requires an authenticated cron endpoint or equivalent worker. It must claim due events and email deliveries idempotently and tolerate retries or delayed execution. Time-based assignment access remains enforced independently by the download route.

Schema implementation will require running `pnpm db:migrate` and reviewing the generated migration carefully for unintended drops before applying or committing it.
