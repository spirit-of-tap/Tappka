import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { school_email, code } = await request.json();

    // Validate inputs
    if (!school_email || !code) {
      return NextResponse.json(
        { error: "Chybi e-mail nebo kod" },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Neautorizovano" },
        { status: 401 }
      );
    }

    // Find the latest unused, non-expired code for this user and email
    const { data: verificationCode, error: codeError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("school_email", school_email.toLowerCase())
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (codeError || !verificationCode) {
      return NextResponse.json(
        { error: "Kod vyprsel nebo neexistuje. Pozadejte o novy." },
        { status: 400 }
      );
    }

    // Check attempts
    if (verificationCode.attempts >= MAX_ATTEMPTS) {
      // Mark code as used (exhausted)
      await supabase
        .from("verification_codes")
        .update({ used: true })
        .eq("id", verificationCode.id);

      return NextResponse.json(
        { error: "Prilis mnoho pokusu. Pozadejte o novy kod." },
        { status: 400 }
      );
    }

    // Check if code matches
    if (verificationCode.code !== code) {
      // Increment attempts
      await supabase
        .from("verification_codes")
        .update({ attempts: verificationCode.attempts + 1 })
        .eq("id", verificationCode.id);

      const remainingAttempts = MAX_ATTEMPTS - verificationCode.attempts - 1;
      return NextResponse.json(
        {
          error: `Neplatny kod. Zbyvajici pokusy: ${remainingAttempts}`,
        },
        { status: 400 }
      );
    }

    // Code is valid! Mark as used
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("id", verificationCode.id);

    // Get role and team from pre_registered_emails
    const { data: preRegistered, error: preRegError } = await supabase
      .from("pre_registered_emails")
      .select("role, team_id")
      .eq("email", school_email.toLowerCase())
      .single();

    if (preRegError || !preRegistered) {
      console.error("Failed to get pre_registered_emails:", preRegError);
      return NextResponse.json(
        { error: "Nepodarilo se nacist data z registrace" },
        { status: 500 }
      );
    }

    // Update profile: set is_verified, school_email, role, and team_id from pre_registered
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        is_verified: true,
        school_email: school_email.toLowerCase(),
        role: preRegistered.role,
        team_id: preRegistered.team_id,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
      return NextResponse.json(
        { error: "Nepodarilo se aktualizovat profil" },
        { status: 500 }
      );
    }

    // Claim the pre-registered email
    await supabase
      .from("pre_registered_emails")
      .update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      })
      .eq("email", school_email.toLowerCase());

    return NextResponse.json({
      success: true,
      verified: true,
      message: "E-mail uspesne overen!",
    });
  } catch (error) {
    console.error("Check code error:", error);
    return NextResponse.json(
      { error: "Interni chyba serveru" },
      { status: 500 }
    );
  }
}
