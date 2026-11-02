// The link protocol and the sync rules must be byte-identical on the website / PC app and in the phone app.
import { readFileSync } from 'node:fs';

let bad = false;
for (const f of ['protocol', 'sync']) {
  const a = readFileSync(new URL(`../web/src/link/${f}.ts`, import.meta.url), 'utf8');
  const b = readFileSync(new URL(`../mobile/src/lib/link/${f}.ts`, import.meta.url), 'utf8');
  if (a !== b) {
    console.error(`web/src/link/${f}.ts and mobile/src/lib/link/${f}.ts differ: copy one over the other.`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log('link protocol and sync rules: web and mobile copies are identical');
