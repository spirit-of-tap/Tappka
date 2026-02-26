# Progress

- **Status:** COMPLETED
- **Timestamp:** 2026-02-25 19:01:22 EET
- **Task:** Enable `Cmd + Enter` submit in reservation dialogs when focus is inside text fields.
- **Completed work:**
  - Added keyboard submit in `components/reservations/quick-reservation-dialog.tsx` (reason textarea).
  - Added keyboard submit in `components/reservations/qr-quick-reserve-dialog.tsx` (title input).
  - Added keyboard submit in `components/reservations/edit-reservation-dialog.tsx` (reason textarea).
  - Added keyboard submit in `components/reservations/reservation-detail-dialog.tsx` (edit title textarea).
  - Added keyboard submit in `components/reservations/issue-report-button.tsx` (description textarea).
  - Added keyboard submit in `components/reservations/schedule-breaks-manager.tsx` (name input in add-break dialog).
  - Verified no lint errors in all touched files.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-25 19:05:01 EET
- **Task:** Keep reservation detail dialog in sync after editing a reservation.
- **Completed work:**
  - Updated `components/reservations/reservation-detail-dialog.tsx` to keep a local `currentReservation` state synchronized with selected reservation.
  - Merged successful PATCH response data into local dialog state so updated title/person count/cowork values are shown immediately after submit.
  - Switched dialog internals to render and act on the local reservation state for save/cancel/join/leave actions.
  - Verified no lint errors in the touched file.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 01:27:02 EET
- **Task:** Make `manifest.json` accessible without auth in proxy matcher.
- **Completed work:**
  - Updated `proxy.ts` matcher exclusions to bypass proxy auth/session handling for `manifest.json`.
  - Preserved existing exclusions for static assets and images.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:16:21 EET
- **Task:** Remove `status` and `reason` from `reservations` and update all dependent code paths.
- **Completed work:**
  - Added and applied migration `supabase/migrations/20260226001550_remove_status_reason_from_reservations.sql`.
  - Removed `status`/`reason` columns from `public.reservations` and rebuilt dependent exclusion/index/policy objects.
  - Updated reservation-related API routes and pages to stop querying/updating reservation `status` and `reason`.
  - Updated recurring schedule and schedule-break flows to delete affected future reservations instead of setting `status = cancelled`.
  - Updated reservation types and UI schedule filtering to rely on time windows only (no reservation status field).
