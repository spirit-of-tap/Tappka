
lib/auth-helpers.ts (1)
39-57: Consider combining queries with a join for better performance.

The function makes two sequential database calls. This could be optimized into a single query using a join, reducing latency and database load.

⚡ Optimized single-query approach
-  // Get the public.users row linked to this auth user
-  const { data: publicUser } = await supabase
-    .from("users")
-    .select("id")
-    .eq("auth_user_id", user.id)
-    .single();
-
-  if (!publicUser) {
-    return false;
-  }
-
-  // Check if there's a profile linked to this user
-  const { data: profile } = await supabase
-    .from("profiles")
-    .select("id")
-    .eq("user_id", publicUser.id)
-    .single();
-
-  return !!profile;
+  // Single query using join to check for linked profile
+  const { data: profile } = await supabase
+    .from("users")
+    .select("profiles(id)")
+    .eq("auth_user_id", user.id)
+    .single();
+
+  return !!profile?.profiles;
This assumes you have a foreign key relationship between users and profiles tables that Supabase can use for the nested select.

---