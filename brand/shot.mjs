import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 840 }, deviceScaleFactor: 1.5 });
await p.goto('file://' + process.cwd() + '/palettes.html'); await p.screenshot({ path: 'palettes.png', fullPage: true }); await b.close();
