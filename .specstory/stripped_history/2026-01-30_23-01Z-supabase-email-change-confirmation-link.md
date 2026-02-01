
The @components/verify-email-form.tsx:53-55 I would like the mail link to work too. It doesn't work right now use supabase mcp with docs to implement handling changing the email using a link.

All you need to do is specify the callback and exchange code for session on a new endpoint

This is what it looks like if you specify it to go to /auth/confirm-email-change. token hash is outdated and isnt used anymore
http://localhost:3000/auth/confirm-email-change?code=664fc8cb-e89b-4489-b39d-ea33fdcf2a48
Request Method


---

---


it doesn't seem like the client got the new jwt

---

---


It went to 
http://localhost:3000/?code=0c16b020-bcae-4dc5-9563-2230f9d81dd8 instead of http://localhost:3000/auth/confirm-email-change?code=664fc8cb-e89b-4489-b39d-ea33fdcf2a48

---

---


where did u set /auth/confirm-email-change?

---

---


"PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies."

Use supabase docs to enable PKCE flow with a custom template

---

---


the template didn't get applied

---

---


Invalid config for auth.email.template.email_change.content_path: open templates/email_change.html: no such file or directory

---