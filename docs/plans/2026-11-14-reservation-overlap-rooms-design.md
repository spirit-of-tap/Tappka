# Parallel reservations across rooms

**Date:** 2026-11-14

## Goal

Let a person hold several active reservations at the same time in
different rooms. Today the app blocks this with a hard 409, even though the
database already allows it.

## What changes

### Server

- `POST /api/reservations` no longer rejects a user who already has an
  overlapping reservation. It looks up those reservations and returns them
  as a non-blocking `warning` payload.
- `PATCH /api/reservations/[id]` does the same when the time range changes.
- A shared helper `findOwnOverlappingReservations()` in
  `src/lib/reservations/queries.ts` owns the lookup.
- A failed warning lookup is logged and ignored; it must never block a
  booking.

Unchanged: the room-level `no_overlap` exclusion constraint and its 409,
operating hours, available-day checks, past-time checks, and RLS.

### Response shape

```json
{
  "success": true,
  "data": { "...": "reservation row" },
  "message": "Rezervace vytvořena",
  "warning": {
    "code": "OWN_RESERVATIONS_OVERLAP",
    "reservations": [
      { "id": "…", "title": "Porada", "room_name": "Ateliér" }
    ]
  }
}
```

`warning` is omitted when there is no overlap, so existing clients keep
working unchanged.

### Client

All three mutating flows (`quick-reservation-dialog`,
`qr-quick-reserve-dialog`, `edit-reservation-dialog`) show a sonner warning
toast when `warning` is present:

- title: `Rezervace vytvořena` / `Rezervace upravena`
- description: `V tomto čase už máš rezervaci: Ateliér.`

The description comes from `formatOwnOverlapWarning()` in
`src/lib/reservations/utils.ts`. Copy is gender-neutral (direct 2nd person,
no gendered participles).

## Non-goals

- Linked multi-room group bookings (one action, several rooms).
- Schema changes or migrations.
- Blocking or confirming double-booking.

## Testing

- Unit: `formatOwnOverlapWarning()` formatting, de-duplication, empty input.
- Integration: active overlapping reservations in different rooms are
  allowed by the DB; same-room overlap still fails.
- E2E: two `POST /api/reservations` calls for the same window in different
  rooms both succeed, and the second returns `warning`.
