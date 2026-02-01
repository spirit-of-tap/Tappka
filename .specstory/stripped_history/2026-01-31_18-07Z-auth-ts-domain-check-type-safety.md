
In `@lib/constants/auth.ts` around lines 19 - 20, Remove the unsafe "as any" cast
and make the domain check type-safe: ensure ALLOWED_WORK_EMAIL_DOMAINS is typed
as an array or Set of strings (e.g., readonly string[] or Set<string>), narrow
the domain to string | undefined (const domain =
email.split('@')[1]?.toLowerCase()), early-return false when domain is
undefined, then call ALLOWED_WORK_EMAIL_DOMAINS.includes(domain) (or
.has(domain) for a Set) so the check uses a properly typed string instead of
any; reference the domain variable and ALLOWED_WORK_EMAIL_DOMAINS in the change.

---