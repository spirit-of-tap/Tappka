# Beta Cohort Feature Access - Design

Date: 2026-08-27
Status: Validated

## Goal

Replace the single all-or-nothing beta switch with persistent A/B cohort
assignment. People can continue to opt into beta themselves. New beta
participants start in cohort A, while admins can assign any beta participant
to A or B.

For the first experiment:

- Cohort A can access Reading.
- Cohort B can access Reading and all other beta features.
- Profiles without beta access cannot access any beta feature.
- Admins always have full access, independently of beta status or cohort.

The cohort is also sent to PostHog so product usage can be compared between A
and B. PostHog is an analytics layer, not the authorization boundary.

## Current State

- `profiles.beta_access_granted_at` records self-service beta enrollment.
- One boolean derived from that timestamp currently unlocks every beta module.
- Navigation, Spotlight, dashboard widgets, pages, APIs, and some notification
  paths each check the beta timestamp independently.
- The `/beta` page lets people enable or disable beta access.
- There is no admin interface for beta participants or experiments.

## Decisions

- Keep self-service beta enrollment.
- Give every profile cohort A by default.
- Backfill existing profiles to A.
- Preserve cohort assignment when beta access is disabled. A disabled profile
  has no beta access, but an admin assignment is restored if beta is enabled
  again.
- Put cohort management in an admin-only section of `/beta`.
- Keep feature-to-cohort requirements in a typed code registry, not editable
  database rows.
- Hide inaccessible features from navigation and search.
- If someone opens a protected URL directly, render a friendly cooking screen
  instead of redirecting or exposing the access rule.
- Continue enforcing access in server pages, APIs, and RLS where applicable.
- Send beta status and cohort to PostHog as person properties.

## Access Matrix

| Profile state | Reading | Other beta features |
| --- | --- | --- |
| No beta access | Denied | Denied |
| Beta, cohort A | Allowed | Denied |
| Beta, cohort B | Allowed | Allowed |
| Admin | Allowed | Allowed |

Stable modules such as Dashboard, Rooms, and Community remain available as
they are today.

## Data Model

Add a Postgres enum and profile column in `db/schema/profiles.ts`:

```ts
export const betaCohort = pgEnum("beta_cohort", ["A", "B"])

betaCohort: betaCohort("beta_cohort").default("A").notNull()
```

The column is non-null because every profile has a stable cohort assignment,
even while beta access is disabled. `beta_access_granted_at` remains the source
of truth for enrollment.

The generated migration must be reviewed for unexpected drops before it is
applied. No drop is intended.

## Central Feature Registry

Create a server-safe, typed registry under `src/lib/feature-access.ts`.
Feature keys should describe capabilities rather than routes. The initial
registry includes Reading and every currently beta-gated surface, for example:

```ts
export const BETA_FEATURES = {
  reading: ["A", "B"],
  customerMeetings: ["B"],
  coaching: ["B"],
  teamReflection: ["B"],
  teamDiary: ["B"],
  teamDocuments: ["B"],
  toolsTechniques: ["B"],
  personalityTests: ["B"],
  birthGiving: ["B"],
  portfolio: ["B"],
  dashboardMetrics: ["B"],
} as const
```

Reading-related notification preferences and email delivery follow the Reading
feature, so both A and B can use them. Notifications belonging to B-only
features follow their feature gate.

One pure function is the decision point:

```ts
canAccessFeature(profile, feature): boolean
```

It grants admins first, denies profiles without beta enrollment, then checks
the profile cohort against the registry. Callers must not recreate cohort
logic locally.

## Navigation And Discovery

Replace `betaOnly` with a feature key on beta-gated navigation entries.
Sidebar, Modules, Spotlight, profile menus, and dashboard catalogs use the
shared helper or an allowed-feature set derived from it.

- Cohort A sees Reading and no B-only destinations.
- Cohort B sees all beta destinations.
- Admins see all beta destinations.
- Profiles outside beta see no beta destinations.

Badges continue to say `Beta`; A/B assignment is not disclosed in normal
navigation.

## Restricted Feature Screen

Direct visits to an unavailable feature render one shared
`FeatureComingSoon` component within the normal application chrome. Protected
routes check access before executing page data queries. APIs return `403` and
RLS remains the data boundary.

The component receives only `featureName`. It contains no cohort label, access
explanation, release date, signup control, request button, or other action.

Approved Czech copy:

> **V kuchyni se něco chystá**
>
> Funkce **Čtení** právě probublává v našem hrnci. Až bude správně dochucená,
> naservírujeme ji.

Only the feature name changes.

The illustration uses semantic color tokens and existing Lucide icons: a
gently bubbling cooking pot, rising steam, and one dropping ingredient. The
animation is CSS-only, decorative (`aria-hidden`), responsive, and static when
`prefers-reduced-motion` is enabled. It must be checked in light and dark
themes.

## Admin Experience

The `/beta` page keeps its existing enrollment content. Admins additionally
see a participant panel containing active beta profiles with:

- Name
- Work email
- Team
- Cohort selector (`A` or `B`)
- Search by name or email

Changing a cohort calls a dedicated admin endpoint. The control is disabled
while saving. Success updates the row and shows a toast. Failure restores the
previous value and shows a destructive toast.

The endpoint:

1. Authenticates the request.
2. Loads the caller profile and requires role `admin`.
3. Validates the target profile ID and cohort value.
4. Confirms the target is an active beta participant.
5. Updates the target through the existing server-side admin client.
6. Returns the saved cohort.

The service-role client is used only after the caller has passed the explicit
admin check.

## PostHog Measurement

After the signed-in profile is loaded, identify the person in PostHog with:

```ts
{
  beta_access: boolean,
  beta_cohort: "A" | "B",
}
```

Existing pageviews and product events can then be segmented by cohort. Access
must never depend on the PostHog client, remote flags, cookies, or event
delivery. Cohort changes become visible to the client after refresh.

## Error And Security Behavior

- Hidden navigation is presentation, not authorization.
- Direct page visits render the cooking screen without querying protected page
  data.
- Protected APIs return a structured `403` response.
- Invalid cohort values return `400`.
- Unauthenticated admin requests return `401`.
- Authenticated non-admin requests return `403`.
- Missing or ineligible target profiles return `404`.
- Client assignment failures roll back optimistic UI state and show a toast.
- Admin bypass is implemented in the shared helper, not repeated by callers.

## Testing

### Unit

- Table-driven access matrix for no beta, A, B, and admin.
- Registry coverage for all beta feature keys.
- Navigation, Modules, Spotlight, profile links, and dashboard filtering.
- Reading notifications remain available to A; B-only notifications do not.

### Component

- Cooking screen renders the supplied feature name and no action.
- Decorative animation is hidden from assistive technology and reduced-motion
  safe.
- Admin participant search and cohort controls.
- Saving state, success toast, failure rollback, and error toast.

### Integration

- `beta_cohort` enum accepts A and B only.
- New profiles default to A.
- Existing profile rows receive A during migration.

### E2E

- A sees and opens Reading.
- A does not discover B-only modules and sees the cooking screen on direct
  visits.
- B sees and opens all beta modules.
- A non-beta profile sees no beta navigation and receives the cooking screen
  on direct visits.
- Admin always has full access and can assign another beta profile to A or B.
- Reassignment changes navigation and direct route access after refresh.
- PostHog identification includes beta status and cohort.

Run the relevant unit, component, integration, and E2E suites, followed by
typecheck, lint, and a production build.

## Out Of Scope

- Admin-editable feature-to-cohort rules.
- More than two cohorts.
- Percentage-based or automatic cohort assignment.
- A custom experiment-results dashboard.
- Using PostHog flags as authorization.
- Showing cohort labels or access details on the restricted feature screen.
