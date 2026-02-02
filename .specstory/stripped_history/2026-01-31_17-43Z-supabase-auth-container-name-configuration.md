
14-14: Hardcoded Docker container name may break if project is renamed.

The container name supabase_auth_Tappka appears to be derived from the project name. If the project is renamed or another developer has a different Supabase project name, this script will fail.

Consider making this configurable via environment variable or documenting this assumption:

-    "docker:restart-auth": "docker restart supabase_auth_Tappka",
+    "docker:restart-auth": "docker restart ${SUPABASE_AUTH_CONTAINER:-supabase_auth_Tappka}",
Note: This shell syntax may not work on Windows cmd. For full cross-platform support, consider moving this to a Node.js script like wait-and-restart-docker.js.

---