
app/auth/confirm-email-change/route.ts (1)
13-13: Unsafe type assertion for type parameter.

The cast as EmailOtpType | null doesn't validate that the query parameter is actually a valid EmailOtpType. An attacker could pass an invalid type value that would be passed directly to verifyOtp.

Consider validating against known OTP types before calling the API.

🛡️ Proposed validation
+const VALID_EMAIL_OTP_TYPES: EmailOtpType[] = ["email_change", "email"];
+
 export async function GET(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const token_hash = searchParams.get("token_hash");
-  const type = searchParams.get("type") as EmailOtpType | null;
+  const typeParam = searchParams.get("type");
+  const type = typeParam && VALID_EMAIL_OTP_TYPES.includes(typeParam as EmailOtpType)
+    ? (typeParam as EmailOtpType)
+    : null;

---