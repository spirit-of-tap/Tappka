
I would like there to be a check whether the adress we're sending the code for changing the email is to an adress ending with @pef.czu.cz or @studenti.czu.cz 

---

---


Now do the same on supabase

---

---


The migration doesn't work. Use the mcp

---

---


I don't have access to the auth schema. Do a more modern trigger approach

---

---


The migration doesn't work. I need server side (supabase level) fix to make sure users can't change their email to anything like that

---

---


This one works well but it doesn't allow creating new accounts with google provider (which at first has the @gmail.com) 

---

---


well now it allows even the normal accounts

I need it to only allow creation of google identity but disallow changing the email of google identity

---

---


Good. Now restrict creating accounts without google provider

---

---


do not use the auth.

---

---


Can you make a page to test this on?

---

---


remove all migrations and push them again

---

---


to remote not locally

---

---


upload everything locally now

---

---


error running before_user_created_hook

---