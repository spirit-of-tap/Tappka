
In `@app/auth/test/auth-test-page-client.tsx` around lines 27 - 35, Change the
user state to use the Supabase User type instead of any and memoize the Supabase
client so it isn’t recreated on every render: import the User type (e.g. User)
from the Supabase package and update useState<any>(null) to useState<User |
null>(null) for the user state (symbol: user, setUser), and wrap createClient()
with useMemo (symbol: supabase) so the client is created once (e.g. const
supabase = useMemo(() => createClient(), [])). Ensure types compile and update
any downstream usage of user accordingly.

---