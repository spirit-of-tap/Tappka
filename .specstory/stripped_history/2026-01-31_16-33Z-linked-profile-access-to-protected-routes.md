
I would like to add a new restriction for authenticated users.

Only the users that have a linked profile will be able to access /protected. Otherwise they will be redirected to page Which tells them they need an admin to approve their email address

Enforce this on the server for all endpoints except / and /auth and static (the way it's setup already. Just add it to that)

Keep it simple stupid and dry

Make sure the middleware handles everything not the client (proxy.ts)

---