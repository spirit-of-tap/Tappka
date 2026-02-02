
In `@app/auth/callback/route.ts` around lines 17 - 23, The identity check is using
a new client which won't have the just-exchanged session; update the code to
reuse the existing supabase instance returned by createClient() after
exchangeCodeForSession() instead of creating a fresh one. Modify
hasEmailIdentity() to accept a Supabase client parameter (or inline the check)
and call it with the local supabase variable (the one used for
exchangeCodeForSession()), so the identity check runs in the same session
context.

---