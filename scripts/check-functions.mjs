/**
 * Syntax-check the Supabase edge functions.
 *
 *   node scripts/check-functions.mjs
 *
 * The Deno edge functions are outside the app's tsconfig, so a stray syntax
 * error would otherwise only surface as a 503 BOOT_ERROR after deploying.
 * esbuild parses them here (transpile only — `npm:` specifiers are left alone)
 * so mistakes are caught locally.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = path.join(root, 'supabase/functions');

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(functionsDir).filter((f) => f.endsWith('.ts'));
let failures = 0;

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  try {
    await esbuild.transform(readFileSync(file, 'utf8'), {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
    });
    console.log(`OK    ${rel}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${rel}`);
    for (const err of error.errors ?? []) {
      console.error(`      ${err.text} (line ${err.location?.line ?? '?'})`);
    }
  }
}

console.log(`\n${files.length - failures}/${files.length} function files parsed`);
process.exit(failures > 0 ? 1 : 0);
