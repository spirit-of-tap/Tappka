
In `@components/verify-email-form.tsx` around lines 235 - 302, The effect
auto-submits when otpCode length equals the magic number 8 and can re-trigger
after a failed verification because isLoading becomes false while otpCode
remains 8; fix by introducing a named constant (e.g., OTP_LENGTH) and track the
last submitted OTP (e.g., lastSubmittedOtp state) or clear otpCode on error so
verifyOTP isn’t called repeatedly — update the useEffect (referencing useEffect,
otpCode, step, isLoading, verifyOTP), set the lastSubmittedOtp when submitting
in handleVerifyOTP/verifyOTP, and in the error branch reset otpCode or
lastSubmittedOtp to prevent re-submission.


Make sure to solve this so that we look for the request and if it fails do not resubmit but keep the code in

---