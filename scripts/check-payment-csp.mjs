/**
 * Guard the payment origins in the Content-Security-Policy.
 *
 *   node scripts/check-payment-csp.mjs
 *
 * The CSP is served from vercel.json. On 2026-10-30 a `script-src 'self'`
 * policy blocked Razorpay's checkout.js and every live order stayed pending.
 * This check runs on `npm run build` so the same regression cannot be
 * deployed silently again.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));

const globalHeaders =
  config.headers?.find((entry) => entry.source === '/(.*)')?.headers ?? [];
const csp = globalHeaders
  .find((header) => header.key?.toLowerCase() === 'content-security-policy')?.value ?? '';

if (!csp) {
  console.error('✖ Payment CSP guard: vercel.json has no Content-Security-Policy header.');
  process.exit(1);
}

const directives = new Map();
for (const part of csp.split(';')) {
  const [name, ...sources] = part.trim().split(/\s+/);
  if (name) directives.set(name, sources);
}

const required = [
  ['script-src', "'self'"],
  ['script-src', 'https://checkout.razorpay.com'],
  ['script-src', 'https://api.razorpay.com'],
  ['script-src', 'https://cdn.razorpay.com'],
  ['frame-src', 'https://api.razorpay.com'],
  ['frame-src', 'https://checkout.razorpay.com'],
  ['connect-src', 'https://api.razorpay.com'],
  ['connect-src', 'https://lumberjack.razorpay.com'],
  ['style-src', 'https://fonts.googleapis.com'],
  ['font-src', 'https://fonts.gstatic.com'],
];

const missing = required.filter(([directive, source]) => {
  const sources = directives.get(directive) ?? [];
  return !sources.includes(source);
});

if (missing.length > 0) {
  console.error('✖ Payment CSP guard: the policy would block a payment dependency.');
  for (const [directive, source] of missing) {
    console.error(`  ${directive} is missing ${source}`);
  }
  console.error('  Fix vercel.json before deploying — see scripts/check-payment-csp.mjs.');
  process.exit(1);
}

console.log('✔ Payment CSP guard: Razorpay, Google Fonts and telemetry origins are allowed.');
