
In `@lib/hooks/use-email-verification-realtime.ts` around lines 20 - 24, The
supabase client is recreated on every render because createClient() is called
outside effects, causing the useEffect that depends on supabase to re-run; fix
by stabilizing the client reference—either move the createClient() call inside
the useEffect that sets up the channel (so it’s created once per subscription)
or wrap createClient() with useMemo (e.g., const supabase = useMemo(() =>
createClient(), []) ) and remove supabase from changing references; also address
the unused payload parameter in the broadcast callback inside the subscription
handler (remove the payload parameter if not needed, or use it appropriately) —
update references in useEmailVerificationRealtime, channelRef, isSubscribedRef,
and the broadcast callback to reflect the change.

---