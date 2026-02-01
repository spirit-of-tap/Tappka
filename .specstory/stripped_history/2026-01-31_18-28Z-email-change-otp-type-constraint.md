
In `@app/auth/confirm-email-change/route.ts` around lines 13 - 18, The endpoint
must only accept the OTP type for email-change; modify the logic around
token_hash/typeParam so the EmailOtpType is constrained to "email_change" only:
replace the current permissive check that uses (VALID_EMAIL_OTP_TYPES as
readonly string[]).includes(typeParam) with an explicit comparison to
"email_change" (e.g., set type to "email_change" only when typeParam ===
"email_change", otherwise null or reject), referencing the existing identifiers
token_hash, typeParam, type and VALID_EMAIL_OTP_TYPES/EmailOtpType in route.ts
to locate and update the code.

---