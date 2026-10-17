/**
 * Generate a bcrypt hash for a password.
 *
 *   node scripts/hash-password.mjs 'your-password'
 *
 * Used to seed/rotate the admin password in the `admins` table (see
 * supabase/migrations/*_payments_admin_feedback.sql). bcryptjs is a dev
 * dependency only — the runtime hashing happens in the Deno edge functions,
 * which import bcryptjs straight from npm.
 */
import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}

const rounds = Number(process.argv[3] ?? 10);
console.log(await bcrypt.hash(password, rounds));
