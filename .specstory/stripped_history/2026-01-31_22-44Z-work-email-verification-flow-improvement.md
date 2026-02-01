
I want to improve the user flow for getting their work email verified. These need to work:

Having user requested the otp from one device and then clicks on the mail link on other device needs to log both devices in.

Requesting otp on one device and then logging in on a different device puts the user back where he was.



How to do this?

supabase realtime. We already have the users table and we will be using the 4 fields

suggested_work_email (the email where the otp was sent to)
last_otp_sent_at (when the otp was sent last time)
Make sure to set the above two using a db function (in migration)

verified_work_email (last verified email)
verified_work_email_at (when verified)

Now it should redirect all users and refresh their tokens whenever verified_work_email changes. Whenever it would redirect them if they just entered the otp.



---

---


apply the migrations using an mcp

---

---


make sure everything you do that it's also in the migration files

---

---


the function errored out

---

---


pnpm lint

---