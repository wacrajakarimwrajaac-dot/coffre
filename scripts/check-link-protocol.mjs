// The Coffre Web link protocol must be byte-identical on the website and in the app.
import { readFileSync } from 'node:fs';

const a = readFileSync(new URL('../web/src/link/protocol.ts', import.meta.url), 'utf8');
const b = readFileSync(new URL('../mobile/src/lib/link/protocol.ts', import.meta.url), 'utf8');
if (a !== b) {
  console.error('web/src/link/protocol.ts and mobile/src/lib/link/protocol.ts differ: copy one over the other.');
  process.exit(1);
}
console.log('link protocol: web and mobile copies are identical');
