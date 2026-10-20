import { readFileSync } from 'node:fs';
const [file, needle, before = '0', after = '1400'] = process.argv.slice(2);
const s = readFileSync(file, 'utf8');
const i = s.indexOf(needle);
if (i < 0) { console.log('NOT FOUND:', needle); process.exit(0); }
const st = Math.max(0, i - Number(before));
const en = Math.min(s.length, i + Number(after));
console.log(s.slice(st, en));
