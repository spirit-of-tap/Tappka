
Validate next to avoid open redirects.

next is taken from the query string and used directly in redirect(), which allows external URLs. Constrain it to same-origin (or relative) paths before using it.

In /auth/callback

---