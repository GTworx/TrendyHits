// Fails the build if tr.json / en.json keys differ, a value is empty,
// or a t('key') used in src/ is missing from the dictionaries.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dicts = Object.fromEntries(
  ['tr', 'en'].map((l) => [l, JSON.parse(readFileSync(join('src/i18n', `${l}.json`), 'utf8'))]),
);
const errors = [];

for (const [x, y] of [['tr', 'en'], ['en', 'tr']]) {
  for (const k of Object.keys(dicts[x])) {
    if (!(k in dicts[y])) errors.push(`"${k}" exists in ${x}.json but is missing in ${y}.json`);
  }
}
for (const [l, d] of Object.entries(dicts)) {
  for (const [k, v] of Object.entries(d)) {
    if (typeof v !== 'string' || !v.trim()) errors.push(`${l}.json: "${k}" is empty`);
  }
}

const walk = (p) =>
  statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : /\.(tsx?|jsx?)$/.test(p) ? [p] : [];
for (const file of walk('src')) {
  for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*['"]([\w.]+)['"]\s*\)/g)) {
    if (!(m[1] in dicts.en)) errors.push(`${file}: t('${m[1]}') has no translation`);
  }
}

if (errors.length) {
  console.error(`✖ i18n check failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✔ i18n OK (${Object.keys(dicts.en).length} keys, tr/en in sync)`);
