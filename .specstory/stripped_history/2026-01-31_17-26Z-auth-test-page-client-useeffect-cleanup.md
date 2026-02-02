
In `@app/auth/test/auth-test-page-client.tsx` around lines 37 - 42, The useEffect
mounts an auth-state listener but doesn't unsubscribe, causing memory leaks;
update the effect in auth-test-page-client.tsx to capture the subscription
returned by supabase.auth.onAuthStateChange (e.g., const { data: subscription }
= supabase.auth.onAuthStateChange(...) or const subscription =
supabase.auth.onAuthStateChange(...), depending on the API) and return a cleanup
function that calls subscription.unsubscribe() to remove the listener on
unmount; keep the initial checkUser() call inside the effect and ensure the
cleanup is returned from the same useEffect so checkUser and the subscription
lifecycle are managed together.

---