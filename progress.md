# Progress

- **Status:** COMPLETED
- **Timestamp:** 2026-06-21 22:24:00 EET
- **Task:** Update backend auth email trigger functions and domain checks for `@rektorat.czu.cz`.
- **Completed work:**
  - Added migration `supabase/migrations/20260621202500_add_rektorat_domain_to_auth_triggers.sql`.
  - Updated `public.validate_czu_email_domain_trigger()` to allow `rektorat.czu.cz`, validate old/new direct email changes, and keep `public.profiles.work_email` in sync for linked profiles.
  - Updated `public.set_verified_work_email_on_change()` to include `rektorat.czu.cz` in verified email updates and backfill query.
  - Updated `public.profiles` domain check constraint `valid_czu_domain` to include `rektorat.czu.cz`.
  - Applied migration via Supabase MCP (`apply_migration`) to keep file and database state aligned.

- **Status:** COMPLETED
- **Timestamp:** 2026-06-21 21:59:00 EET
- **Task:** Add frontend support for `@rektorat.czu.cz` in work email verification.
- **Completed work:**
  - Added `rektorat.czu.cz` to `ALLOWED_WORK_EMAIL_DOMAINS` in `lib/constants/auth.ts`, so frontend domain validation accepts it.
  - Added `@rektorat.czu.cz` to the domain dropdown options in `components/verify-email-form.tsx`.
  - Verified no lint errors in touched files.

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

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:26:16 EET
- **Task:** Create script to transform legacy reservations CSV into Supabase import format.
- **Completed work:**
  - Added `scripts/prepare-reservations-import.js` to transform `scripts/reservations_input.csv` into `public.reservations` import-ready rows.
  - Implemented room mapping via `scripts/rooms_rows.csv` (`code` -> `id`), UUID generation, and reservation type mapping (`training_session` when TS column is filled, otherwise `personal`).
  - Implemented Czech datetime parsing (`DD.MM.YYYY H:mm`) and conversion to UTC `timestamptz` format (`YYYY-MM-DD HH:mm:ss+00`).
  - Generated `scripts/reservations_import.csv` (77 transformed rows) for manual Supabase CSV import.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:31:01 EET
- **Task:** Fix invalid reservation time ranges in generated import CSV.
- **Completed work:**
  - Updated `scripts/prepare-reservations-import.js` to validate transformed time ranges and handle bad legacy end times.
  - Added fallback duration repair when source `end_time <= start_time`:
    - `training_session`: `start_time + 4h`
    - `personal`: `start_time + 1h`
  - Regenerated `scripts/reservations_import.csv`; script reported 26 adjusted rows.
  - Verified resulting CSV has zero invalid ranges (`end_time > start_time` for all rows).

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:32:55 EET
- **Task:** Enforce "first reserved wins" overlap behavior in CSV transform.
- **Completed work:**
  - Updated `scripts/prepare-reservations-import.js` to filter overlapping reservations per room before export.
  - Implemented deterministic keep-order for conflicts: earliest `created_at` wins, then source row order as tiebreaker.
  - Regenerated `scripts/reservations_import.csv`; script reported 1 overlap row removed.
  - Verified generated CSV has no room-level overlapping intervals.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:39:26 EET
- **Task:** Add CZU domain dropdown to onboarding email verification input.
- **Completed work:**
  - Updated `components/verify-email-form.tsx` to split email entry into local part input and domain dropdown.
  - Added domain options `@studenti.czu.cz` (default) and `@pef.czu.cz`.
  - Kept OTP/send flow unchanged by composing and persisting the full email from local part + selected domain.
  - Added handling for pasted full emails so domain selection and local part are parsed automatically.
  - Verified no lint errors in the touched file.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:50:22 EET
- **Task:** Fix `validate_picture_only_update()` to allow admin/postgres updates.
- **Completed work:**
  - Added migration `supabase/migrations/20260226005022_fix_profile_picture_trigger_for_admin_sessions.sql`.
  - Updated `public.validate_picture_only_update()` bypass logic to trust `session_user`/`current_user` admin roles in addition to JWT/database role checks.
  - Kept regular user protection in place so only `picture` updates are allowed for non-admin sessions.
  - Applied migration via MCP (`fix_profile_picture_trigger_for_admin_sessions`) to keep local SQL and database state aligned.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 02:58:12 EET
- **Task:** Show Mailpit shortcut on verify-email screen in developer mode.
- **Completed work:**
  - Updated `components/verify-email-form.tsx` to render a Mailpit external-link button when `process.env.NODE_ENV === "development"`.
  - Added `DEV_MAILPIT_URL` constant and reused shadcn `Button` with `next/link` + `ExternalLink` icon for consistent UI.
  - Kept production behavior unchanged by gating the button behind developer mode only.
  - Verified no lint errors in the touched file.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 03:01:44 EET
- **Task:** Fix verify-email OTP auto-redirect and paste behavior.
- **Completed work:**
  - Updated `components/verify-email-form.tsx` to render OTP slots dynamically from `OTP_LENGTH`, keeping UI and validation in sync.
  - Added a global paste listener on OTP step so `Cmd/Ctrl+V` works even when OTP input is not focused.
  - Kept auto-submit behavior intact (typed/pasted full OTP now triggers verification and redirect reliably).
  - Verified no lint errors in touched files.

- **Status:** COMPLETED
- **Timestamp:** 2026-02-26 10:24:00 EET
- **Task:** Remove the 14-day reservation limit in fetch and write flows.
- **Completed work:**
  - Removed `MAX_ADVANCE_BOOKING_DAYS` from `lib/reservations/types.ts` and the booking window helper in `lib/reservations/utils.ts`.
  - Dropped the API reservation create guard that blocked dates beyond 14 days in `app/api/reservations/route.ts`.
  - Expanded room detail data fetch to include all future reservations and schedule breaks in `app/(main)/reservations/[code]/page.tsx`.
