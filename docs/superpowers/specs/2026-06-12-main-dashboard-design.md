# Main dashboard (`/`) — design

Date: 2026-06-12
Status: approved (chat)

## Goal

Replace the placeholder profile page at `app/(main)/page.tsx` with a role-aware
"action hub" dashboard: what needs my attention + where do I go next.

## Decisions

- Fixed layout, no user-editable widgets in v1 (revisit if requested).
- Server component, single `Promise.all` of cheap queries.
- Roles: student & mentor share the student view; coach & admin share the coach
  view (mirrors `/eseje/ke-kontrole` access check).
- Czech copy, shadcn/Tailwind components from `components/ui`, typography
  consistent with `/prehled`.

## Layout

Common (all roles):

- `FirstLoginConfetti` kept.
- Hero greeting (`Vítej, <first name>!`) + today's date.
- Quick actions row.
- Slim HelpDesk link at the bottom (existing Teams URL).
- Profile-detail rows removed (live in `/komunita/profil` and settings).

Student / mentor:

- Quick actions: Napsat esej (`/eseje/nova`), Rezervovat místnost
  (`/reservations`), Hledat knihu (`/hledat`).
- **Čtení card**: book points + essay counts from `getUserBookPointsStats`,
  link to `/prehled`.
- **Nadcházející rezervace card**: next reservation (`user_id = profile.id`,
  `end_time > now()`, order `start_time`, limit 1) with room name; empty state
  with CTA to `/reservations`.

Coach / admin (additions/changes):

- **Ke kontrole card first**: unread count via `getCoachUnreadCount`, 3 newest
  unread essays via `getUnreadTeamEssaysForCoach`, link to
  `/eseje/ke-kontrole`. Handles no-team case.
- **Team reading snapshot**: top 3 from `getTeamBookPointsStats`.
- Quick actions swap "Napsat esej" for "Zkontrolovat eseje".
- Reservation card kept.

## Error handling / empty states

Every block renders a sensible empty state (no team, no points, no essays, no
reservation) so a fresh user sees a coherent page. Query failures degrade to
empty states rather than crashing the page.

## Testing / verification

No existing component-test infra for pages; verify via typecheck, lint, build,
and manual run for each role.
