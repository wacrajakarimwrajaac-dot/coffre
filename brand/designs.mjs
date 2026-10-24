import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const P = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  plane: '<path d="M3 13l18-8-5 16-4-6z"/><path d="m12 15 9-10"/>',
  dumbbell: '<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
  utensils: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M17 3c-2 2-2 6 0 8v10"/>',
  droplet: '<path d="M12 3s6 6 6 11a6 6 0 0 1-12 0c0-5 6-11 6-11z"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  run: '<circle cx="15" cy="5" r="2"/><path d="m8 21 3-6 3 2 1 4M10 13l-3-2 4-4 3 3 3 1"/>',
};
const ic = (n, s = 22, c = 'currentColor', w = 1.7) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
const ring = (pct, size, stroke, c1, c2, track, label, sub) => {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `<div style="position:relative;width:${size}px;height:${size}px"><svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
  <defs><linearGradient id="g${size}${c1.slice(1)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="url(#g${size}${c1.slice(1)})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><b style="font-size:${size/3.4}px;letter-spacing:-1px">${label}</b><span style="font-size:11px;opacity:.65">${sub}</span></div></div>`;
};

const base = `*{box-sizing:border-box;margin:0}body{font-family:Inter,'Segoe UI',system-ui,sans-serif;background:#1c1c1f;padding:30px;display:flex;gap:30px;width:max-content;-webkit-font-smoothing:antialiased}
.cap{color:#fff;font-size:13px;opacity:.7;margin:0 0 10px;width:360px}.cap b{display:block;font-size:18px;opacity:1;margin-bottom:2px}
.ph{width:360px;height:700px;border-radius:38px;overflow:hidden;position:relative;background:var(--bg);color:var(--tx)}
.pad{padding:22px 20px 0}.row{display:flex;align-items:center}.mut{color:var(--mu)}`;

// ---------------------------------------------------------------- Concept 1 : Épuré
const c1 = `
.c1{--bg:#0E0F13;--tx:#F3F4F6;--mu:#8A8F9C;--ln:#1F222A;--ac:#8B7CFF;--ok:#3DD9A0}
.c1 .brand{font-weight:700;font-size:15px;letter-spacing:.2px;display:flex;align-items:center;gap:8px}
.c1 .av{width:32px;height:32px;border-radius:50%;background:#1d2029;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin-left:auto}
.c1 h1{font-size:30px;font-weight:700;letter-spacing:-.8px;margin:22px 0 2px}.c1 .date{font-size:13px;color:var(--mu)}
.c1 .srch{display:flex;gap:10px;align-items:center;padding:14px 0;border-bottom:1px solid var(--ln);color:var(--mu);font-size:14px;margin-top:14px}
.c1 .chips{display:flex;gap:8px;margin-top:16px}.c1 .chip{display:flex;gap:7px;align-items:center;padding:9px 13px;border-radius:99px;border:1px solid #2a2e38;font-size:13px;font-weight:600}
.c1 .lbl{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:var(--mu);margin:24px 0 6px;font-weight:600}
.c1 .li{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--ln)}
.c1 .tile{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.c1 .li b{font-size:15px;font-weight:600;display:block}.c1 .li span.s{font-size:12.5px;color:var(--mu)}
.c1 .tab{position:absolute;left:0;right:0;bottom:0;height:74px;border-top:1px solid var(--ln);background:#0E0F13;display:flex;justify-content:space-around;padding-top:12px}
.c1 .tab div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:var(--mu)}.c1 .tab .on{color:var(--tx)}
.c1 .tab .on i{width:4px;height:4px;border-radius:50%;background:var(--ac);display:block}
.c1 .days{display:flex;gap:6px;margin-top:10px}.c1 .days div{flex:1;text-align:center;font-size:11px;color:var(--mu)}.c1 .days i{display:block;height:8px;border-radius:4px;margin-top:6px;background:#23262f}.c1 .days .d i{background:var(--ac)}
.c1 .bar{height:4px;background:#23262f;border-radius:2px;margin-top:10px}.c1 .bar i{display:block;height:4px;width:62%;background:linear-gradient(90deg,#8B7CFF,#FF6AA8);border-radius:2px}
.c1 .hab{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--ln)}
.c1 .cb{width:24px;height:24px;border-radius:50%;border:1.8px solid #3a3f4c;display:flex;align-items:center;justify-content:center}.c1 .cb.on{background:var(--ok);border-color:var(--ok);color:#06251b}
`;
const f1 = (n, name, sub, col, icn) => `<div class="li"><div class="tile" style="background:${col}22;color:${col}">${ic(icn, 20)}</div><div style="flex:1"><b>${name}</b><span class="s">${sub}</span></div><span class="mut">${ic('chev', 18)}</span></div>`;
const tab1 = (a) => `<div class="tab">${[['home', 'Accueil'], ['image', 'Médias'], ['flame', 'Discipline'], ['sliders', 'Réglages']].map(([i, l], k) => `<div class="${k === a ? 'on' : ''}">${ic(i, 22)}${l}${k === a ? '<i></i>' : ''}</div>`).join('')}</div>`;
const home1 = `<div class="ph c1"><div class="pad">
  <div class="row"><div class="brand"><span style="color:var(--ac)">${ic('folder', 20)}</span>Coffre</div><div class="av">A</div></div>
  <h1>Aujourd’hui</h1><div class="date">Samedi 24 octobre</div>
  <div class="srch">${ic('search', 18)}Rechercher dans tes dossiers</div>
  <div class="chips"><div class="chip">${ic('link', 16)}Lien</div><div class="chip">${ic('note', 16)}Note</div><div class="chip">${ic('mic', 16)}Vocal</div><div class="chip">${ic('plus', 16)}Tâche</div></div>
  <div class="lbl">Discipline</div>
  <div class="row"><b style="font-size:22px;letter-spacing:-.5px">3 sur 5</b><span class="mut" style="margin-left:auto;font-size:13px;display:flex;gap:6px;align-items:center;color:#FF9F6A">${ic('flame', 16)} 12 jours</span></div>
  <div class="bar"><i></i></div>
  <div class="days">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<div class="${i < 5 ? 'd' : ''}">${d}<i></i></div>`).join('')}</div>
  <div class="lbl">Dossiers</div>
  ${f1(0, 'Voyage Marrakech', '23 éléments · 235 Mo', '#5B9DFF', 'plane')}${f1(0, 'Fitness', '7 éléments · 330 Mo', '#3DD9A0', 'dumbbell')}${f1(0, 'Recettes', '5 éléments · 11 Mo', '#FF9F6A', 'utensils')}
  </div>${tab1(0)}</div>`;
const habit1 = (icn, name, sub, on, col) => `<div class="hab"><div class="cb ${on ? 'on' : ''}">${on ? ic('check', 14, '#06251b', 2.6).replace('<circle cx="12" cy="12" r="9"/>', '') : ''}</div><div class="tile" style="width:34px;height:34px;border-radius:10px;background:${col}22;color:${col}">${ic(icn, 18)}</div><div style="flex:1"><b style="font-size:15px;font-weight:600;${on ? 'opacity:.5;text-decoration:line-through' : ''}">${name}</b><div class="mut" style="font-size:12.5px">${sub}</div></div><span style="font-size:13px;color:#FF9F6A;display:flex;gap:3px;align-items:center">${ic('flame', 14)}${on ? 12 : 4}</span></div>`;
const disc1 = `<div class="ph c1"><div class="pad">
  <h1 style="margin-top:6px">Discipline</h1><div class="date">Samedi 24 octobre</div>
  <div class="row" style="gap:22px;margin:22px 0 4px">${ring(0.6, 118, 10, '#8B7CFF', '#FF6AA8', '#23262f', '3/5', 'aujourd’hui')}
   <div style="flex:1"><div class="mut" style="font-size:12px">Ce mois-ci</div><b style="font-size:28px;letter-spacing:-1px">78 %</b><div class="mut" style="font-size:12.5px;margin-top:2px">de régularité · +6 pts</div>
   <div class="row" style="gap:3px;margin-top:12px;height:34px;align-items:flex-end">${[40, 55, 35, 70, 62, 80, 74, 90, 78, 85].map((h) => `<i style="flex:1;height:${h}%;background:#8B7CFF;opacity:${.35 + h / 160};border-radius:3px;display:block"></i>`).join('')}</div></div></div>
  <div class="row" style="gap:22px;margin:18px 0 0;border-bottom:1px solid var(--ln);font-size:14px;font-weight:600"><span style="padding-bottom:10px;border-bottom:2px solid var(--ac)">Aujourd’hui</span><span class="mut" style="padding-bottom:10px">Habitudes</span><span class="mut" style="padding-bottom:10px">Statistiques</span></div>
  ${habit1('droplet', 'Boire 2 L d’eau', 'Chaque jour · 09:00', true, '#5B9DFF')}${habit1('run', 'Courir 30 min', 'Lun · Mer · Ven', false, '#3DD9A0')}${habit1('book', 'Défi lecture', 'Jour 25 sur 90', false, '#FF6AA8')}
  </div>${tab1(2)}</div>`;

// ---------------------------------------------------------------- Concept 2 : Bento clair
const c2 = `
.c2{--bg:#F3F3F6;--tx:#14141B;--mu:#7A7A8C;--ac:#5B4BFF}
.c2 .t{background:#fff;border-radius:26px;padding:16px;box-shadow:0 1px 2px rgba(20,20,40,.04),0 10px 30px rgba(20,20,40,.06)}
.c2 .g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.c2 h1{font-size:28px;font-weight:700;letter-spacing:-.8px}
.c2 .hero{grid-column:span 2;background:linear-gradient(135deg,#1B1B2E,#2B2160 60%,#5B4BFF);color:#fff;display:flex;align-items:center;gap:16px;padding:18px}
.c2 .ci{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.c2 .lbl{font-size:12px;font-weight:700;letter-spacing:.4px;color:var(--mu);margin:20px 4px 10px;display:flex;justify-content:space-between}
.c2 .tab{position:absolute;left:18px;right:18px;bottom:16px;height:62px;border-radius:24px;background:#14141B;display:flex;align-items:center;justify-content:space-around;color:#8d8da3}
.c2 .tab .on{background:#fff;color:#14141B;border-radius:16px;padding:9px 16px;display:flex;gap:6px;align-items:center;font-size:12px;font-weight:700}
.c2 .qa{display:flex;gap:10px;margin-top:14px}.c2 .qa div{flex:1;background:#fff;border-radius:18px;padding:12px 0;text-align:center;font-size:11.5px;font-weight:600;display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:0 1px 2px rgba(20,20,40,.04)}
.c2 .hrow{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border-radius:20px;margin-bottom:8px;box-shadow:0 1px 2px rgba(20,20,40,.04)}
.c2 .cb{width:24px;height:24px;border-radius:8px;border:2px solid #d3d3de;display:flex;align-items:center;justify-content:center}.c2 .cb.on{background:#5B4BFF;border-color:#5B4BFF;color:#fff}
.c2 .wk{display:flex;gap:8px}.c2 .wk div{flex:1;text-align:center;font-size:11px;color:var(--mu);font-weight:600}.c2 .wk i{display:flex;margin:6px auto 0;width:30px;height:30px;border-radius:50%;background:#EDEDF3;align-items:center;justify-content:center;color:#fff}.c2 .wk .d i{background:#5B4BFF}.c2 .wk .today i{background:#fff;border:2px solid #5B4BFF;color:#5B4BFF}
`;
const ft = (icn, name, sub, col) => `<div class="t" style="padding:14px"><div class="ci" style="background:${col}1f;color:${col};width:40px;height:40px;border-radius:14px">${ic(icn, 20)}</div><b style="display:block;margin-top:14px;font-size:15px">${name}</b><span class="mut" style="font-size:12px">${sub}</span></div>`;
const tab2 = (a) => `<div class="tab">${[['home', 'Accueil'], ['image', 'Médias'], ['flame', 'Discipline'], ['sliders', 'Réglages']].map(([i, l], k) => k === a ? `<div class="on">${ic(i, 18)}${l}</div>` : ic(i, 22)).join('')}</div>`;
const home2 = `<div class="ph c2"><div class="pad">
  <div class="row"><div><div class="mut" style="font-size:13px">Samedi 24 octobre</div><h1>Bonjour 👋</h1></div><div class="ci" style="background:#14141B;color:#fff;margin-left:auto;font-weight:700;font-size:14px">A</div></div>
  <div class="g" style="margin-top:16px">
    <div class="t hero">${ring(0.6, 92, 9, '#FFFFFF', '#FFB0D5', 'rgba(255,255,255,.18)', '3/5', 'aujourd’hui')}<div><b style="font-size:17px">Plus que 2 habitudes</b><div style="font-size:12.5px;opacity:.75;margin:4px 0 8px">Continue, tu es à 78 % ce mois-ci</div><span style="display:inline-flex;gap:5px;align-items:center;background:rgba(255,255,255,.16);padding:5px 10px;border-radius:99px;font-size:12px;font-weight:700">${ic('flame', 14)} 12 jours</span></div></div>
    <div class="t"><div class="mut" style="font-size:12px;font-weight:600">Espace</div><b style="font-size:24px;letter-spacing:-.6px">389 Mo</b><div style="height:5px;background:#EDEDF3;border-radius:3px;margin-top:8px"><i style="display:block;height:5px;width:78%;background:#5B4BFF;border-radius:3px"></i></div><div class="mut" style="font-size:11px;margin-top:6px">sur 500 Mo</div></div>
    <div class="t"><div class="mut" style="font-size:12px;font-weight:600">Tâches</div><b style="font-size:24px;letter-spacing:-.6px">2</b><div class="mut" style="font-size:11.5px;margin-top:8px">1 en retard · prochaine 19:30</div></div>
  </div>
  <div class="qa"><div>${ic('link', 20)}Lien</div><div>${ic('note', 20)}Note</div><div>${ic('mic', 20)}Vocal</div><div>${ic('plus', 20)}Tâche</div></div>
  <div class="lbl"><span>DOSSIERS</span><span style="color:var(--ac)">+ Nouveau</span></div>
  <div class="g">${ft('plane', 'Voyage', '23 éléments', '#5B4BFF')}${ft('dumbbell', 'Fitness', '7 éléments', '#10B981')}</div>
  </div>${tab2(0)}</div>`;
const hab2 = (icn, name, sub, on, col) => `<div class="hrow"><div class="cb ${on ? 'on' : ''}">${on ? ic('check', 14, '#fff', 2.8).replace('<circle cx="12" cy="12" r="9"/>', '') : ''}</div><div class="ci" style="width:36px;height:36px;border-radius:12px;background:${col}1f;color:${col}">${ic(icn, 18)}</div><div style="flex:1"><b style="font-size:14.5px;${on ? 'opacity:.45;text-decoration:line-through' : ''}">${name}</b><div class="mut" style="font-size:12px">${sub}</div></div><span style="font-size:12.5px;font-weight:700;color:#F59E0B;display:flex;gap:3px;align-items:center">${ic('flame', 14)}${on ? 12 : 4}</span></div>`;
const disc2 = `<div class="ph c2"><div class="pad">
  <h1>Discipline</h1><div class="mut" style="font-size:13px;margin-bottom:14px">Samedi 24 octobre</div>
  <div class="t"><div class="wk">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<div class="${i < 5 ? 'd' : i === 5 ? 'today' : ''}">${d}<i>${i < 5 ? ic('check', 14, '#fff', 2.8).replace('<circle cx="12" cy="12" r="9"/>', '') : ''}</i></div>`).join('')}</div></div>
  <div class="g" style="margin-top:12px"><div class="t" style="display:flex;justify-content:center;padding:14px">${ring(0.6, 104, 10, '#5B4BFF', '#A78BFA', '#EDEDF3', '3/5', 'aujourd’hui')}</div>
   <div class="t"><div class="mut" style="font-size:12px;font-weight:600">Ce mois</div><b style="font-size:30px;letter-spacing:-1px">78%</b><div class="row" style="gap:3px;margin-top:10px;height:38px;align-items:flex-end">${[40, 55, 35, 70, 62, 80, 74, 90].map((h) => `<i style="flex:1;height:${h}%;background:#5B4BFF;opacity:${.3 + h / 150};border-radius:3px;display:block"></i>`).join('')}</div></div></div>
  <div class="lbl"><span>À FAIRE AUJOURD’HUI</span></div>
  ${hab2('droplet', 'Boire 2 L d’eau', 'Chaque jour', true, '#3B82F6')}${hab2('run', 'Courir 30 min', 'Lun · Mer · Ven', false, '#10B981')}${hab2('book', 'Défi lecture', 'Jour 25 sur 90', false, '#EC4899')}
  </div>${tab2(2)}</div>`;

const page = (css, a, b, t1, t2) => `<style>${base}${css}</style><body><div><div class="cap"><b>${t1}</b>${t2}</div>${a}</div><div><div class="cap">&nbsp;<br>&nbsp;</div>${b}</div></body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 820 }, deviceScaleFactor: 1.5 });
await p.setContent(page(c1, home1, disc1, 'Concept 1 · Épuré', 'Sobre, éditorial. Listes, filets fins, icônes en trait, un seul accent. Façon Linear / Things.')); await p.screenshot({ path: 'concept-1.png', fullPage: true });
await p.setContent(page(c2, home2, disc2, 'Concept 2 · Bento', 'Tuiles aérées, mode clair, anneaux de progression, barre d’onglets flottante. Façon Arc / widgets iOS.')); await p.screenshot({ path: 'concept-2.png', fullPage: true });
await b.close(); console.log('ok');
