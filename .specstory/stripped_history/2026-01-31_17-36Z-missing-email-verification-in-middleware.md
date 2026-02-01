
Missing email identity verification step in middleware flow.

The middleware checks for publicUser and profile linkage but doesn't verify email identity first. Users who have authenticated via Google but haven't verified their work email would be redirected to /auth/pending-approval instead of /auth/verify-email.

This creates an inconsistent user experience where users see "Pending Approval" when they actually need to complete email verification first.

---