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
