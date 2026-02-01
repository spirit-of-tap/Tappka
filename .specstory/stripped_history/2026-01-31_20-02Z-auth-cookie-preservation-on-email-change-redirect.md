
In `@app/auth/confirm-email-change/route.ts` around lines 1 - 61, The route  
currently calls redirect() from next/navigation which throws and prevents the  
auth cookies set via createServerClient/verifyOtp from reaching the client;  
update the GET handler to return a NextResponse.redirect(...) (or use the  
existing redirectWithCookies helper) and copy all cookies from  
supabaseResponse.cookies into that response before returning so the session  
cookie is preserved for all paths (invalid type, missing token_hash, verifyOtp  
error, and successful redirect to "/protected"); locate the logic around GET,  
supabaseResponse, createServerClient and the verifyOtp call and replace each  
redirect(...) invocation with a returned NextResponse.redirect that includes the  
cookies from supabaseResponse.  

---

---


can we dry?

---

---


more dry

---

---


Can we put this into an auth helper and make sure auth/callback uses it too?

---