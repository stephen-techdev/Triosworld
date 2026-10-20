import { readFileSync } from 'node:fs';
const s = readFileSync(process.argv[2], 'utf8');
const needle = process.argv[3];
const re = new RegExp(needle, 'g');
let m;
while ((m = re.exec(s))) {
  const line = s.slice(0, m.index).split('\n').length;
  console.log(`--- line ${line} ---`);
  console.log(s.slice(Math.max(0, m.index - 200), m.index + 120));
}
