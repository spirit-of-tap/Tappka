import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Rate limiting: max 3 code requests per hour per user
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms
const MAX_REQUESTS_PER_WINDOW = 3;
const CODE_EXPIRY_MINUTES = 15;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { school_email } = await request.json();

    // Validate email format - allow @pef.czu.cz or @studenti.czu.cz
    const validDomains = ["@pef.czu.cz", "@studenti.czu.cz"];
    const hasValidDomain = validDomains.some((domain) =>
      school_email.toLowerCase().endsWith(domain)
    );

    if (!school_email || !hasValidDomain) {
      return NextResponse.json(
        { error: "Neplatný formát e-mailu. Použijte @pef.czu.cz nebo @studenti.czu.cz" },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Neautorizováno" },
        { status: 401 }
      );
    }

    // Check if email is in pre-registered list
    const { data: preRegistered, error: preRegError } = await supabase
      .from("pre_registered_emails")
      .select("id, claimed_by")
      .eq("email", school_email.toLowerCase())
      .single();

    if (preRegError || !preRegistered) {
      return NextResponse.json(
        { error: "Tento e-mail není v systému registrován. Kontaktujte administrátora." },
        { status: 400 }
      );
    }

    // Check if email already claimed by someone else
    if (preRegistered.claimed_by && preRegistered.claimed_by !== user.id) {
      return NextResponse.json(
        { error: "Tento e-mail už byl ověřen jiným uživatelem" },
        { status: 400 }
      );
    }

    // Rate limiting: check recent code requests
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW).toISOString();
    const { count } = await supabase
      .from("verification_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);

    if (count && count >= MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        { error: "Příliš mnoho pokusů. Zkuste to za hodinu." },
        { status: 429 }
      );
    }

    // Invalidate any existing unused codes for this user
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("used", false);

    // Generate new code
    const code = generateCode();
    const expiresAt = new Date(
      Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    // Save code to database
    const { error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        user_id: user.id,
        school_email: school_email.toLowerCase(),
        code,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Failed to insert verification code:", insertError);
      return NextResponse.json(
        { error: "Nepodařilo se vytvořit ověřovací kód" },
        { status: 500 }
      );
    }

    // TODO: Send email with code using your email service
    // For now, log the code in development
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Verification code for ${school_email}: ${code}`);
    }

    // In production, you would send the email here:
    // await sendVerificationEmail(school_email, code);

    return NextResponse.json({ success: true, message: "Kód odeslán" });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json(
      { error: "Interní chyba serveru" },
      { status: 500 }
    );
  }
}
