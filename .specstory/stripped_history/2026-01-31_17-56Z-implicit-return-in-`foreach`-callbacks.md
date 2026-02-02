
app/auth/confirm-email-change/route.ts-28-37 (1)
28-37: ⚠️ Potential issue | 🟡 Minor

Fix forEach callbacks that implicitly return values.

Biome correctly flags that the callbacks passed to forEach() should not return values. The cookies.set() method returns a value, but forEach expects void callbacks.

🔧 Proposed fix using block bodies
           setAll(cookiesToSet) {
-            cookiesToSet.forEach(({ name, value }) =>
-              request.cookies.set(name, value),
-            );
+            cookiesToSet.forEach(({ name, value }) => {
+              request.cookies.set(name, value);
+            });
             supabaseResponse = NextResponse.next({
               request,
             });
-            cookiesToSet.forEach(({ name, value, options }) =>
-              supabaseResponse.cookies.set(name, value, options),
-            );
+            cookiesToSet.forEach(({ name, value, options }) => {
+              supabaseResponse.cookies.set(name, value, options);
+            });
           },

---