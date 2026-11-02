// Copies the built website (web/dist) into the app, where main.cjs serves it.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../web/dist', import.meta.url));
const to = fileURLToPath(new URL('../web-dist', import.meta.url));
if (!existsSync(from)) throw new Error('web/dist introuvable : lance « npm run build » dans web/ d\'abord.');
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log('Site copié dans desktop/web-dist');
