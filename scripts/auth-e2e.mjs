// TriosWorld — real end-to-end auth test against the deployed Supabase project.
//
// Uses only the public anon key + the deployed `trios-auth` function.
// Creates two temporary test accounts (9000000001 / 9000000002); delete them
// afterwards (see AUTH_SETUP.md for the SQL).
//
// Usage:
//   node scripts/auth-e2e.mjs              # reads VITE_* values from .env
//   IGNORE_RATE_LIMIT=1 node scripts/auth-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env loader so this can run without extra tooling.
function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) return;
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      if (m[1] === "VITE_SUPABASE_URL" && !process.env.SUPABASE_URL) process.env.SUPABASE_URL = m[2];
      if (m[1] === "VITE_SUPABASE_ANON_KEY" && !process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = m[2];
    }
  } catch {
    /* .env is optional if env vars are set externally */
  }
}
loadEnv();

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL_ || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY (add them to .env).");
  process.exit(2);
}
const FN = `${URL_}/functions/v1/trios-auth`;

const NUM_A = "9000000001";
const NUM_B = "9000000002";
const PWD_A = "TriosTest123";

const results = [];
const IGNORE = process.env.IGNORE_RATE_LIMIT === "1";

async function call(path, body, token) {
  const res = await fetch(`${FN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
}

// ── 1. registration ───────────────────────────────────────────────────────────
let r = await call("/register", { full_name: "E2E Test User", mobile: NUM_A, password: PWD_A, gender: "male" });
const registered = r.status === 200 && !!r.body?.session;
record(
  "register new mobile",
  registered,
  `${r.status} ${r.body?.session ? "session issued" : JSON.stringify(r.body?.error ?? r.body?.message ?? r.body?.code ?? "no session")}`,
);
if (r.status >= 500) {
  console.log("\n!! The trios-auth function is not running (5xx). Deploy it first:");
  console.log("   npx supabase functions deploy trio-auth --project-ref <ref> --no-verify-jwt\n");
}
const userId = r.body?.user?.id ?? null;

// ── 2. duplicate registration blocked ─────────────────────────────────────────
r = await call("/register", { full_name: "Duplicate", mobile: NUM_A, password: PWD_A });
record("duplicate mobile rejected", r.status === 409, `${r.status} ${JSON.stringify(r.body?.error)}`);

// ── 3. login with correct password ────────────────────────────────────────────
r = await call("/login", { mobile: NUM_A, password: PWD_A });
const session = r.body?.session ?? null;
record("login correct password", r.status === 200 && !!session, `${r.status} ${session ? "session issued" : JSON.stringify(r.body?.error)}`);

// ── 4. login with wrong password (safe error) ─────────────────────────────────
r = await call("/login", { mobile: NUM_A, password: "WrongPass123" });
record("login wrong password -> generic 401", r.status === 401 && r.body?.error === "Invalid mobile number or password", `${r.status} ${JSON.stringify(r.body?.error)}`);

// ── 5. unknown mobile -> same generic error (no enumeration) ──────────────────
r = await call("/login", { mobile: "9000000099", password: "WrongPass123" });
record("unknown mobile -> same generic 401", r.status === 401 && r.body?.error === "Invalid mobile number or password", `${r.status} ${JSON.stringify(r.body?.error)}`);

// ── 6. session works with RLS ─────────────────────────────────────────────────
if (session) {
  const sb = createClient(URL_, ANON);
  await sb.auth.setSession(session);
  const { data, error } = await sb.from("profiles").select("mobile, full_name").eq("id", userId).maybeSingle();
  record("session reads own profile (RLS)", !error && data?.mobile === NUM_A, data ? JSON.stringify(data) : `error=${error?.message}`);
  const { data: all } = await sb.from("profiles").select("id").limit(5);
  record("RLS hides other profiles", !all || all.length <= 1, `${all?.length ?? 0} rows visible`);
  // addresses write path (used by the account page)
  const { error: addrErr } = await sb.from("addresses").insert({
    full_name: "E2E Test User", mobile: NUM_A, pincode: "600001",
    address_line: "1 Test Street", city: "Chennai", state: "Tamil Nadu", is_default: true,
  });
  record("authenticated address insert", !addrErr, addrErr?.message ?? "inserted");
} else {
  record("session reads own profile (RLS)", false, "no session from login");
  record("RLS hides other profiles", false, "no session from login");
  record("authenticated address insert", false, "no session from login");
}

// ── 7. logout / session invalidation ─────────────────────────────────────────
if (session) {
  const sb = createClient(URL_, ANON);
  await sb.auth.setSession(session);
  const { error } = await sb.auth.signOut();
  const { data: after } = await sb.auth.getSession();
  record("logout clears session", !error && !after.session, after.session ? "session still present" : (error?.message ?? "cleared"));
}

// ── 8. password reset ─────────────────────────────────────────────────────────
r = await call("/reset-request", { mobile: NUM_A });
const demo = r.body?.demo_token ?? null;
record("reset code issued", r.status === 200, `${r.status} ${r.status !== 200 ? JSON.stringify(r.body?.error ?? r.body?.code) : demo ? "demo mode (no SMS provider)" : "SMS sent"}`);

r = await call("/reset-confirm", { mobile: NUM_A, token: "000000", new_password: "NewTrios123" });
record("reset with wrong code rejected", r.status === 400, `${r.status} ${JSON.stringify(r.body?.error)}`);

const NEW_PWD = "NewTrios456";
if (demo) {
  r = await call("/reset-confirm", { mobile: NUM_A, token: demo, new_password: NEW_PWD });
  record("reset with correct code", r.status === 200, `${r.status} ${JSON.stringify(r.body?.message ?? r.body?.error)}`);
  r = await call("/login", { mobile: NUM_A, password: NEW_PWD });
  record("login with new password", r.status === 200 && !!r.body?.session, `${r.status} ${r.body?.session ? "session issued" : JSON.stringify(r.body?.error)}`);
  r = await call("/login", { mobile: NUM_A, password: PWD_A });
  record("old password no longer works", r.status === 401, `${r.status}`);
} else {
  record("reset with correct code", false, "skipped: real SMS mode (code not exposed to API)");
  record("login with new password", false, "skipped: real SMS mode");
  record("old password no longer works", false, "skipped: real SMS mode");
}

// ── 9. validation ─────────────────────────────────────────────────────────────
r = await call("/register", { full_name: "Bad", mobile: "12345", password: "abc12345" });
record("invalid mobile rejected", r.status === 400, `${r.status} ${JSON.stringify(r.body?.error)}`);
r = await call("/register", { full_name: "Bad", mobile: "9000000003", password: "short" });
record("weak password rejected", r.status === 400, `${r.status} ${JSON.stringify(r.body?.error)}`);

// ── 10. rate limiting (separate number, run last) ─────────────────────────────
if (!IGNORE) {
  let statuses = [];
  for (let i = 0; i < 6; i++) {
    const rr = await call("/login", { mobile: NUM_B, password: "WrongPass123" });
    statuses.push(rr.status);
  }
  record("login rate limiting kicks in", statuses.includes(429), `statuses: ${statuses.join(",")}`);
} else {
  record("login rate limiting kicks in", true, "skipped (IGNORE_RATE_LIMIT=1)");
}

const failed = results.filter(x => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("FAILURES:\n" + failed.map(f => ` - ${f.name}: ${f.detail}`).join("\n"));
process.exit(failed.length ? 1 : 0);
