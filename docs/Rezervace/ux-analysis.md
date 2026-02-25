# UX Analysis: Reservations Section

> Analyzed against the 29 Laws of UX

---

## Interaction & Discoverability

### Issue: Drag-to-create reservation has no visual affordance

**Principle:** Paradox of the Active User + Jakob's Law

**Severity:** major

**Why:** Users never read instructions and start clicking immediately. The drag-to-create gesture on day/week views (`day-schedule.tsx`, `week-schedule.tsx`) has no hint, ghost element, or tooltip to signal it exists. Most users will click once and leave without discovering the feature.

**Recommendation:** Add a subtle "drag to create" tooltip on first visit, or a dashed "ghost" slot on hover that hints at creation.


### Issue: Conflict resolution dialog shows no duration for suggested alternatives

**Principle:** Working Memory + Cognitive Load

**Severity:** minor

**Why:** When a conflict is detected, users are offered "book before" and "book after" alternatives — but only the start time is shown, not the resulting duration. Users must mentally calculate whether the slot is useful, increasing cognitive load.

**Recommendation:** Show the available duration alongside the start time (e.g., "14:00 — 45 min available").


## Optimistic UI & Error Recovery

### Issue: Failed cowork join shows no recovery path

**Principle:** Peak-End Rule + Postel's Law

**Severity:** minor

**Why:** `available-coworks.tsx` hides a joined cowork item only after the server confirms success (after `await` + toast). If the request fails, the item remains visible but the user sees a toast error with no explicit retry affordance — there is no button or prompt to try again.

**Recommendation:** Add a "Retry" action to the error toast, or keep the item in a visually distinct "failed" state with an inline retry button.

---

## Navigation

### Issue: Broken relative URLs on alternative room links in QR flow

**Principle:** Jakob's Law (baseline functional expectation)

**Severity:** critical

**Why:** In `room-quick-status.tsx`, alternative room links use `` `reservations/${altRoom.code}/quick` `` (no leading `/`). These resolve relative to the current URL, producing broken paths like `/reservations/A1/reservations/B2/quick`.

**Recommendation:** Prefix with `/`: `` `/reservations/${altRoom.code}/quick` ``

---

### Issue: No back-to-rooms navigation on room detail page

**Principle:** Mental Model + Jakob's Law

**Severity:** minor

**Why:** Users arriving via QR code or direct link have no visible path to the main rooms list. The only escape is the browser back button, which may not exist in kiosk/PWA contexts.

**Recommendation:** Add a breadcrumb or "All rooms" link at the top of `/reservations/[code]`.

