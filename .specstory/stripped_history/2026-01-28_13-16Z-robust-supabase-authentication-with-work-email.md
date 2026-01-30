
I want to build a robust authentication system.

We use nexts with supabase for auth using cookie auth

I need each users to be in a list of pre-approved work email adresses (specific adresses under our own domain). We want the users to be able to use their google login and verify with work email. This will be stored in supabase database with proper rls. Each user profile will have also permissions for different stuff. With admin having everything

We want the least logic to build ourself and want to offload responsibilities to supabase since we expect change in the dev team and want to make sure that it stays safe even after we leave.

We want to do:

google login -> add a work email -> otp/mail link sent to work email -> checking on each request using jwt if the work email is linked an in db list

Ie always having google linked to the work email indentity

I want to use manual linking https://supabase.com/docs/guides/auth/auth-identity-linking?queryGroups=language&language=js#manual-linking-beta

---

---


I would like the email to be checked before the otp is sent to have @studenti.czu.cz or @pef.czu.cz domain. Do not check for specific emails from the allowlist before getting the otp from the user

---

---


When would it be better to do manage user claims in the database instead of the jwt token

---

---


Can we add that we have a supabase directory with supabase mcp where we can test and do the custom claims hook

---

---


make sure to make sure the implementation is as simple as possible and all of the code is required to run and there are no authentication leftovers

---

---


What is trpc

---

---


yes but we don't want the users to be allowed to create other senarious than google login + work email

---

---


update the plan

---