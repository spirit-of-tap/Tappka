
I would like to replace the current email + password login with google login.

I have already set the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

The auth should be the same no matter if the user enters the password to his google account or not. And It should be the same even when they don't have the account. Just do register.

On all occastions redirect to /protected whenever the user is logged in. Make sure it's always clicking the button and straight to protected

Use the supabase mcp and best pracises when implementing this. Make sure it's simple and not overcomplicating it.

The only login option in the end will be the google login

---