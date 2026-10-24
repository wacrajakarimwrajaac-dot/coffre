// Generates the Coffre logo (SVG) and every icon/splash PNG via headless Chromium.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const NAVY = '#0b1020', NAVY2 = '#18223f';
const defs = `
  <linearGradient id="lid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a6e"/><stop offset="1" stop-color="#ff6b5b"/></linearGradient>
  <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b5b"/><stop offset="1" stop-color="#e2434f"/></linearGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${NAVY2}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient>`;

// Symbol drawn in a 1024 box: folder-tab lid + chest body + diamond clasp.
const symbol = (mono = false) => {
  const lid = mono ? '#fff' : 'url(#lid)', body = mono ? '#fff' : 'url(#body)';
  const clasp = mono ? '#000' : '#fff6f1', claspStroke = mono ? '#fff' : NAVY;
  return `
  <rect x="300" y="250" width="190" height="90" rx="34" fill="${lid}"/>
  <rect x="262" y="300" width="500" height="180" rx="58" fill="${lid}"/>
  <rect x="262" y="500" width="500" height="260" rx="58" fill="${body}"/>
  <rect x="300" y="560" width="424" height="14" rx="7" fill="${mono ? '#000' : NAVY}" opacity="${mono ? 0 : 0.18}"/>
  <g transform="translate(512 490) rotate(45)">
    <rect x="-66" y="-66" width="132" height="132" rx="22" fill="${clasp}" stroke="${claspStroke}" stroke-width="22"/>
  </g>`;
};

const svg = ({ bg = true, scale = 1, mono = false, size = 1024, radius = 0, viewBox = '0 0 1024 1024' } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">
  <defs>${defs}</defs>
  ${bg ? `<rect width="1024" height="1024" rx="${radius}" fill="url(#bg)"/>` : ''}
  <g transform="translate(512 505) scale(${scale}) translate(-512 -505)">${symbol(mono)}</g>
</svg>`;

const outputs = [
  // [path, svg options]
  ['../mobile/assets/icon.png', { bg: true, scale: 1 }],
  ['../mobile/assets/android-icon-foreground.png', { bg: false, scale: 0.78 }],
  ['../mobile/assets/android-icon-monochrome.png', { bg: false, scale: 0.78, mono: true }],
  ['../mobile/assets/splash-icon.png', { bg: false, scale: 1 }],
  ['../mobile/assets/favicon.png', { bg: true, scale: 1, size: 48, radius: 220 }],
  ['../web/public/apple-touch-icon.png', { bg: true, scale: 1, size: 180 }],
  ['../web/public/icon-512.png', { bg: true, scale: 1, size: 512, radius: 0 }],
  ['../site/logo.png', { bg: true, scale: 1, size: 256, radius: 220 }],
  ['preview.png', { bg: true, scale: 1, size: 512, radius: 220 }],
  // Tight crop of the symbol for in-app logos.
  ['../mobile/assets/logo-mark.png', { bg: false, scale: 1, size: 256, viewBox: '236 230 552 552' }],
];

mkdirSync('../web/public', { recursive: true });
writeFileSync('logo.svg', svg({ bg: true, radius: 220 }));
writeFileSync('logo-symbol.svg', svg({ bg: false }));
writeFileSync('../web/public/favicon.svg', svg({ bg: true, radius: 220, size: 64 }));
writeFileSync('../site/favicon.svg', svg({ bg: true, radius: 220, size: 64 }));

const b = await chromium.launch();
for (const [path, opts] of outputs) {
  const size = opts.size ?? 1024;
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg({ ...opts, size })}</body></html>`);
  await p.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await p.close();
}
// Solid background layer for Android adaptive icons.
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs>${defs}</defs><rect width="1024" height="1024" fill="url(#bg)"/></svg></body></html>`);
await p.screenshot({ path: '../mobile/assets/android-icon-background.png' });
await b.close();
console.log('ok');
