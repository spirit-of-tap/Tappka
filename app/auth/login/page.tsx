import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to protected page if already logged in
  if (data?.claims) {
    redirect(DEFAULT_LOGGED_IN_PAGE);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
