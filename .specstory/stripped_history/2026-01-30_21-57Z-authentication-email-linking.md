
Let's improve the authentication.

We will need to force everyone to link an email with otp login method to the google oauth login otherwise they won't be able to continue to /protected.

So:

1. Create a new page that sends an otp code using supabase authenticate with otp and link it to the currently signed in supabase acc
2. Let users into /protected only after they have successfully managed to verify their second email via otp (they can type a different email then the google one)

---

---


The accounts are not linked. Use the supabase mcp to figure out why

---