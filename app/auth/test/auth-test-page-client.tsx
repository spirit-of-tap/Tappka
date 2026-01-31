"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleLoginButton } from "@/components/google-login-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Client component for auth restrictions testing
 * Tests:
 * - Google OAuth signup (should work)
 * - Email/password signup (should be blocked)
 * - OTP email signup (should be blocked)
 * - Email identity addition (should validate CZU domain)
 */
export function AuthTestPageClient() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<{
    emailPassword?: { success: boolean; message: string };
    emailOTP?: { success: boolean; message: string };
    emailIdentity?: { success: boolean; message: string };
  }>({});

  const supabase = createClient();

  useEffect(() => {
    checkUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    setUser(currentUser);
    setLoading(false);
  };

  const testEmailPasswordSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setTestResults((prev) => ({
          ...prev,
          emailPassword: {
            success: false,
            message: error.message || "Signup failed",
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          emailPassword: {
            success: true,
            message: "Signup succeeded (this should not happen!)",
          },
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
      setTestResults((prev) => ({
        ...prev,
        emailPassword: {
          success: false,
          message: message || "Unexpected error",
        },
      }));
    }
  };

  const testEmailOTPSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setTestResults((prev) => ({
          ...prev,
          emailOTP: {
            success: false,
            message: error.message || "OTP signup failed",
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          emailOTP: {
            success: true,
            message: "OTP sent (this should not happen!)",
          },
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
      setTestResults((prev) => ({
        ...prev,
        emailOTP: {
          success: false,
          message: message || "Unexpected error",
        },
      }));
    }
  };

  const testEmailIdentityAddition = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    if (!user) {
      setTestResults((prev) => ({
        ...prev,
        emailIdentity: {
          success: false,
          message: "You must be logged in to test email identity addition",
        },
      }));
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        email: email.trim(),
      });

      if (error) {
        setTestResults((prev) => ({
          ...prev,
          emailIdentity: {
            success: false,
            message: error.message || "Failed to add email identity",
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          emailIdentity: {
            success: true,
            message: "Email identity update initiated (check email for OTP)",
          },
        }));
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err);
      setTestResults((prev) => ({
        ...prev,
        emailIdentity: {
          success: false,
          message: message || "Unexpected error",
        },
      }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTestResults({});
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auth Restrictions Test</h1>
          <p className="text-muted-foreground mt-2">
            Test Google-only signups and CZU email validation
          </p>
        </div>
        {user && (
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        )}
      </div>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Current Auth State</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-2">
              <div>
                <strong>User ID:</strong> {user.id}
              </div>
              <div>
                <strong>Email:</strong> {user.email || "No email"}
              </div>
              <div>
                <strong>Identities:</strong>
                <div className="mt-2 space-y-1">
                  {user.identities?.map((identity: any) => (
                    <Badge key={identity.id} variant="outline" className="mr-2">
                      {identity.provider}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Not logged in</div>
          )}
        </CardContent>
      </Card>

      {/* Test 1: Google OAuth Signup */}
      <Card>
        <CardHeader>
          <CardTitle>Test 1: Google OAuth Signup</CardTitle>
          <CardDescription>
            This should work - Google OAuth signups are allowed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleLoginButton />
          <p className="text-sm text-muted-foreground mt-4">
            Click to test Google OAuth signup. Should succeed.
          </p>
        </CardContent>
      </Card>

      {/* Test 2: Email/Password Signup */}
      <Card>
        <CardHeader>
          <CardTitle>Test 2: Email/Password Signup</CardTitle>
          <CardDescription>
            This should be blocked - only Google OAuth is allowed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={testEmailPasswordSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-password">Email</Label>
              <Input
                id="email-password"
                name="email"
                type="email"
                placeholder="test@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="password123"
                required
              />
            </div>
            <Button type="submit">Test Email/Password Signup</Button>
          </form>
          {testResults.emailPassword && (
            <div
              className={`mt-4 p-3 rounded-md ${testResults.emailPassword.success
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
                }`}
            >
              <strong>Result:</strong> {testResults.emailPassword.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test 3: Email OTP Signup */}
      <Card>
        <CardHeader>
          <CardTitle>Test 3: Email OTP Signup</CardTitle>
          <CardDescription>
            This should be blocked - only Google OAuth is allowed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={testEmailOTPSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-otp">Email</Label>
              <Input
                id="email-otp"
                name="email"
                type="email"
                placeholder="test@example.com"
                required
              />
            </div>
            <Button type="submit">Test Email OTP Signup</Button>
          </form>
          {testResults.emailOTP && (
            <div
              className={`mt-4 p-3 rounded-md ${testResults.emailOTP.success
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-green-100 text-green-800"
                }`}
            >
              <strong>Result:</strong> {testResults.emailOTP.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test 4: Email Identity Addition (CZU Domain Validation) */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Test 4: Add Email Identity (CZU Domain Validation)</CardTitle>
            <CardDescription>
              Test adding email identity - should only allow @pef.czu.cz or @studenti.czu.cz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={testEmailIdentityAddition} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-identity">Email (must be CZU domain)</Label>
                <Input
                  id="email-identity"
                  name="email"
                  type="email"
                  placeholder="your.email@pef.czu.cz"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Must end with @pef.czu.cz or @studenti.czu.cz
                </p>
              </div>
              <Button type="submit">Test Email Identity Addition</Button>
            </form>
            {testResults.emailIdentity && (
              <div
                className={`mt-4 p-3 rounded-md ${testResults.emailIdentity.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                  }`}
              >
                <strong>Result:</strong> {testResults.emailIdentity.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>✓ Test 1 (Google OAuth):</strong> Should succeed - user can sign up
          </div>
          <div>
            <strong>✗ Test 2 (Email/Password):</strong> Should fail with error message
            about Google OAuth only
          </div>
          <div>
            <strong>✗ Test 3 (Email OTP):</strong> Should fail with error message about
            Google OAuth only
          </div>
          <div>
            <strong>✓ Test 4 (CZU Email):</strong> Should succeed only with @pef.czu.cz
            or @studenti.czu.cz domains
          </div>
          <div>
            <strong>✗ Test 4 (Non-CZU Email):</strong> Should fail with domain validation
            error
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
