
app/auth/test/auth-test-page-client.tsx (3)
59-62: Remove unused data variable.

The data variable from signUp response is declared but never used. This pattern repeats in testEmailOTPSignup (line 98) and testEmailIdentityAddition (line 152).

Proposed fix
-      const { data, error } = await supabase.auth.signUp({
+      const { error } = await supabase.auth.signUp({
         email,
         password,
       });

---