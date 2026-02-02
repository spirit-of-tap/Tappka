
Implement a next parameter across the whole authentication process

---

---


It works good with login but it has the url and after that the parameters don't get consumed. Make sure they get consumed when used. However make sure that it's uri compatible with there being url parameters in the next url

---

---


The url parameter doesn't survive the redirect from proxy.ts

---

---


Infinite redirect happens when I have invalid token http://localhost:3000/auth/login?next=%2Fprotected

Ie when I delete the user in supabase this happens

@node (1017-1036) 

---

---


It's not passed into supabase mail link. Use redirect to parameter when changing the email

---

---


@components/verify-email-form.tsx:126 

Make sure there is either ? or & trailing after the url (so that we can put token hash in there)

---

---


Make sure that if we're from mail verification or qcode redirected to pending-approval-page to strip all query parameters

---