
-            <Suspense>
-              <AuthButton />
-            </Suspense>
+            <Suspense
+              fallback={
+                <div
+                  className="h-8 w-28 animate-pulse rounded bg-muted"
+                  aria-hidden="true"
+                />
+              }
+            >
+              <AuthButton />
+            </Suspense>

---