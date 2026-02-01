
In `@lib/supabase/proxy.ts` around lines 55 - 84, The redirects in the auth proxy  
(the branches that currently call NextResponse.redirect()) can drop refreshed  
session cookies from supabaseResponse; update each redirect path (the  
unauthenticated redirect, missing authUser redirect, missing email identity  
using hasEmailIdentity(supabase), and missing linked profile using  
hasLinkedProfile(supabase)) to return a response that copies cookies from  
supabaseResponse before redirecting — either by invoking the existing  
redirectWithCookies helper from lib/auth-helpers.ts or by attaching  
supabaseResponse.cookies to the NextResponse redirect so any tokens set during  
supabase.auth.getUser()/getClaims() are preserved.  

---