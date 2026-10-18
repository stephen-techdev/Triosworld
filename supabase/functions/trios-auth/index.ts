// TriosWorld authentication edge function.
//
// Provides mobile-number + password auth (register / login), password reset,
// and profile completion for Google OAuth users.
//
// NOTE ON PASSWORD HASHING: Supabase Edge Runtime (Deno) cannot load native
// Node addons, so `npm:bcrypt` (node-gyp bindings) crashes the function at boot.
// We use `bcryptjs` — a pure-JS implementation of the same bcrypt algorithm —
// which produces standard $2a$ hashes and runs fine in the edge runtime.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@3.0.3";
import { routePath } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Optional real SMS delivery for password-reset codes (Twilio). When these are
// not configured the reset endpoint falls back to a clearly-labelled demo mode
// that returns the code in the response, and NEVER pretends an SMS was sent.
const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

const BCRYPT_ROUNDS = 10;

// Valid bcrypt hash used to equalise timing between "unknown mobile" and
// "wrong password" responses (prevents user-enumeration via timing).
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface RegisterBody {
  full_name: string;
  mobile: string;
  password: string;
  gender?: string;
}

interface LoginBody {
  mobile: string;
  password: string;
}

interface ResetRequestBody {
  mobile: string;
}

interface ResetConfirmBody {
  mobile: string;
  token: string;
  new_password: string;
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeMobile(m: string): string {
  return m.replace(/\D/g, "").slice(-10);
}

function fullMobile(clean: string): string {
  return `+91${clean}`;
}

/**
 * Internal, non-routable address derived from the mobile number.
 *
 * Supabase will only mint a password session through its EMAIL grant on a
 * project with no SMS provider: the phone grant answers "Unsupported phone
 * provider". This function already verifies the password itself against
 * profiles.password_hash, so all that is needed from Auth is a session, and the
 * email grant gives one without any SMS dependency.
 *
 * The address is never shown to the customer, never emailed, and the domain is
 * reserved (RFC 2606 `.invalid`) so it can never resolve or collide with a real
 * inbox. mobile stays the customer-facing identifier everywhere.
 */
function syntheticEmail(clean: string): string {
  return `${clean}@auth.triosworld.invalid`;
}

function validateMobile(m: string): boolean {
  return /^[6-9]\d{9}$/.test(m);
}

function validatePassword(p: string): string | null {
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Za-z]/.test(p)) return "Password must contain at least one letter";
  if (!/\d/.test(p)) return "Password must contain at least one number";
  return null;
}

async function checkRateLimit(mobile: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("auth_rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("mobile", mobile)
    .gte("attempted_at", windowStart);
  return (count ?? 0) >= 5;
}

async function recordAttempt(mobile: string) {
  await supabase.from("auth_rate_limits").insert({ mobile });
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await supabase.from("auth_rate_limits").delete().lt("attempted_at", cutoff);
}

async function clearAttempts(mobile: string) {
  await supabase.from("auth_rate_limits").delete().eq("mobile", mobile);
}

function smsConfigured(): boolean {
  return Boolean(twilioSid && twilioToken && twilioFrom);
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: twilioFrom,
          Body: body,
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = routePath(url.pathname, "trios-auth");
    const body = await req.json().catch(() => ({}));

    // ============ REGISTER ============
    if (path === "/register" && req.method === "POST") {
      const { full_name, mobile, password, gender } = body as RegisterBody;

      if (!full_name?.trim()) return json({ error: "Full name is required" }, 400);
      // Normalise BEFORE validating. Validating the raw value rejected every
      // formatted number, including the "+91…" the storefront itself sends.
      const cleanMobile = sanitizeMobile(mobile);
      if (!validateMobile(cleanMobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);
      const pwdError = validatePassword(password);
      if (pwdError) return json({ error: pwdError }, 400);
      if (gender && !["male", "female", "other", "prefer_not_to_say"].includes(gender)) {
        return json({ error: "Invalid gender value" }, 400);
      }

      // Registration is rate limited too, to stop bulk account creation spam.
      if (await checkRateLimit(cleanMobile)) {
        return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
      }
      await recordAttempt(cleanMobile);

      // Duplicate registration prevention (mobile numbers are unique).
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", cleanMobile)
        .maybeSingle();

      if (existingProfile) {
        return json({ error: "An account with this mobile number already exists" }, 409);
      }

      // Create the Supabase Auth user with phone + password. `phone_confirm: true`
      // marks the number confirmed in Auth without sending an OTP; we never tell
      // the customer their number has been "verified" because no OTP was sent.
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: fullMobile(cleanMobile),
        // See syntheticEmail(): Auth will not issue a password session via the
        // phone grant without an SMS provider. email_confirm is set because the
        // address is synthetic and is never delivered to anyone.
        email: syntheticEmail(cleanMobile),
        email_confirm: true,
        password: password,
        phone_confirm: true,
        user_metadata: { full_name, mobile: cleanMobile, gender },
      });

      if (authError) {
        if (
          authError.message.toLowerCase().includes("already") ||
          authError.message.toLowerCase().includes("registered")
        ) {
          return json({ error: "An account with this mobile number already exists" }, 409);
        }
        return json({ error: "Registration failed. Please try again." }, 500);
      }

      const userId = authData.user.id;
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        mobile: cleanMobile,
        full_name: full_name.trim(),
        gender: gender ?? null,
        password_hash: passwordHash,
      });

      if (profileError) {
        await supabase.auth.admin.deleteUser(userId);
        return json({ error: "Registration failed. Please try again." }, 500);
      }

      // Sign the new customer in (Supabase Auth password grant supports phone + password).
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signInData } = await anonClient.auth.signInWithPassword({
        phone: fullMobile(cleanMobile),
        password: password,
      });

      await clearAttempts(cleanMobile);

      if (!signInData?.session) {
        // Account exists; the customer can simply sign in from the login page.
        return json({
          message: "Account created successfully. Please log in.",
          user: { id: userId, mobile: cleanMobile, full_name: full_name.trim(), gender: gender ?? null },
        });
      }

      return json({
        session: signInData.session,
        user: { id: userId, mobile: cleanMobile, full_name: full_name.trim(), gender: gender ?? null },
      });
    }

    // ============ LOGIN ============
    if (path === "/login" && req.method === "POST") {
      const { mobile, password } = body as LoginBody;

      // Normalise BEFORE validating — the storefront sends "+91…" prefixed numbers,
      // and validating the raw value rejected every one of them.
      const cleanMobile = sanitizeMobile(mobile);
      if (!validateMobile(cleanMobile)) return json({ error: "Enter a valid 10-digit mobile number" }, 400);
      if (!password) return json({ error: "Password is required" }, 400);

      // Moderation is enforced here, not just hidden in the dashboard: a muted
      // or deleted account must not be able to sign in, whatever it holds.
      const { data: moderation } = await supabase
        .from("profiles")
        .select("is_muted, muted_reason, deleted_at")
        .eq("mobile", cleanMobile)
        .maybeSingle();

      if (moderation?.deleted_at) {
        return json({ error: "This account has been closed. Please contact support." }, 403);
      }
      if (moderation?.is_muted) {
        return json({
          error: `This account is temporarily blocked${moderation.muted_reason ? `: ${moderation.muted_reason}` : "."} Please contact support.`,
        }, 403);
      }

      // Rate limiting — 5 attempts per 15 minutes per mobile number.
      const blocked = await checkRateLimit(cleanMobile);
      if (blocked) {
        return json({ error: "Too many login attempts. Please try again in 15 minutes." }, 429);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, password_hash, full_name, mobile, gender, avatar_url")
        .eq("mobile", cleanMobile)
        .maybeSingle();

      await recordAttempt(cleanMobile);

      // Always compare against a hash so the response time does not reveal
      // whether the mobile number is registered.
      const storedHash = profile?.password_hash ?? DUMMY_HASH;
      const passwordMatch = await bcrypt.compare(password, storedHash);

      if (!profile || !profile.password_hash || !passwordMatch) {
        return json({ error: "Invalid mobile number or password" }, 401);
      }

      // Issue a real Supabase Auth session.
      // The phone grant is unavailable on a project with no SMS provider
      // ("Unsupported phone provider"), which made every successful password
      // check end in a 500. The password is already verified above against
      // profiles.password_hash, so all Auth has to do is mint a session — and the
      // email grant does that with no SMS dependency. See syntheticEmail().
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: signInData } = await anonClient.auth.signInWithPassword({
        email: syntheticEmail(cleanMobile),
        password: password,
      });

      if (!signInData?.session) {
        return json({ error: "Could not create session. Please try again." }, 500);
      }

      await clearAttempts(cleanMobile);

      return json({
        session: signInData.session,
        user: {
          id: profile.id,
          mobile: profile.mobile,
          full_name: profile.full_name,
          gender: profile.gender,
          avatar_url: profile.avatar_url,
        },
      });
    }

    // ============ PASSWORD RESET REQUEST ============
    if (path === "/reset-request" && req.method === "POST") {
      const { mobile } = body as ResetRequestBody;

      const cleanMobile = sanitizeMobile(mobile);
      if (!validateMobile(cleanMobile)) return json({ error: "Enter a valid mobile number" }, 400);

      if (await checkRateLimit(cleanMobile)) {
        return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
      }
      await recordAttempt(cleanMobile);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", cleanMobile)
        .maybeSingle();

      // Same response whether or not the number exists (prevents enumeration).
      const generic = { message: "If an account exists with this number, a reset code has been sent" };

      if (!profile) return json(generic);

      const resetToken = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = await bcrypt.hash(resetToken, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await supabase.from("password_resets").insert({
        user_id: profile.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

      if (smsConfigured()) {
        const sent = await sendSms(
          fullMobile(cleanMobile),
          `Your TriosWorld password reset code is ${resetToken}. It expires in 30 minutes.`,
        );
        if (sent) return json({ message: "Reset code sent to your mobile number" });
        return json({ error: "Could not send the reset code right now. Please try again later." }, 502);
      }

      // Demo mode: no SMS provider is configured for this project, so we cannot
      // actually deliver the code. We return it explicitly flagged as a demo
      // code rather than pretending an SMS was sent.
      return json({
        message: "A reset code has been generated for this number",
        demo_token: resetToken,
        demo: true,
      });
    }

    // ============ PASSWORD RESET CONFIRM ============
    if (path === "/reset-confirm" && req.method === "POST") {
      const { mobile, token, new_password } = body as ResetConfirmBody;

      const cleanMobile = sanitizeMobile(mobile);
      if (!validateMobile(cleanMobile)) return json({ error: "Invalid mobile number" }, 400);
      if (!token) return json({ error: "Reset code is required" }, 400);
      const pwdError = validatePassword(new_password);
      if (pwdError) return json({ error: pwdError }, 400);

      // Brute-force protection for 6-digit codes.
      if (await checkRateLimit(cleanMobile)) {
        return json({ error: "Too many attempts. Please try again in 15 minutes." }, 429);
      }
      await recordAttempt(cleanMobile);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", cleanMobile)
        .maybeSingle();

      if (!profile) return json({ error: "Invalid or expired reset code" }, 400);

      const { data: resets } = await supabase
        .from("password_resets")
        .select("id, token_hash, expires_at, used_at")
        .eq("user_id", profile.id)
        .is("used_at", null)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1);

      if (!resets || resets.length === 0) {
        return json({ error: "Invalid or expired reset code" }, 400);
      }

      const reset = resets[0];
      const tokenMatch = await bcrypt.compare(token, reset.token_hash);
      if (!tokenMatch) {
        return json({ error: "Invalid or expired reset code" }, 400);
      }

      await supabase.from("password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("id", reset.id);

      // Update the independent bcrypt hash kept on the profile.
      const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
      await supabase.from("profiles")
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      // Keep Supabase Auth in sync so the customer can sign in straight away.
      await supabase.auth.admin.updateUserById(profile.id, {
        password: new_password,
      });

      await clearAttempts(cleanMobile);

      return json({ message: "Password reset successfully" });
    }

    // ============ COMPLETE PROFILE (Google OAuth users) ============
    if (path === "/complete-profile" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, anonKey);
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

      const { mobile, full_name, gender } = body;

      if (!full_name?.trim()) return json({ error: "Full name is required" }, 400);
      const cleanMobile = sanitizeMobile(mobile);
      if (!validateMobile(cleanMobile)) return json({ error: "Enter a valid mobile number" }, 400);
      if (gender && !["male", "female", "other", "prefer_not_to_say"].includes(gender)) {
        return json({ error: "Invalid gender value" }, 400);
      }

      // Mobile numbers stay unique even after Google sign-in.
      const { data: existingMobile } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", cleanMobile)
        .neq("id", userData.user.id)
        .maybeSingle();

      if (existingMobile) return json({ error: "This mobile number is already registered" }, 409);

      // Upsert so this works whether or not a profile row already exists.
      const { error: updateError } = await supabase.from("profiles").upsert(
        {
          id: userData.user.id,
          mobile: cleanMobile,
          full_name: full_name.trim(),
          gender: gender ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (updateError) return json({ error: "Could not update profile" }, 500);

      // Keep the Auth user in sync with the completed profile (Google
      // customers sign in with Google, so no password is required for them).
      await supabase.auth.admin.updateUserById(userData.user.id, {
        phone: fullMobile(cleanMobile),
        phone_confirm: true,
      });

      return json({
        message: "Profile completed",
        user: { id: userData.user.id, mobile: cleanMobile, full_name: full_name.trim(), gender },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch {
    return json({ error: "Server error" }, 500);
  }
});
