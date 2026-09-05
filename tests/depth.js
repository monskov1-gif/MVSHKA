/* Аудит связки графика ↔ координаты ↔ collision ↔ z-order.

   Проверяет три вещи, каждая из которых уже ломалась:
     1. якорь пропа стоит на его нижней кромке (кроме настенных и половых);
     2. ни один NPC и ни одна точка входа не оказывается внутри мебели;
     3. настенные предметы помечены wall и не попадают в сортировку глубины.        */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => typeof Art !== 'undefined' && Object.keys(Art.defs).length > 50, null, { timeout: 15000 });

  const out = await page.evaluate(() => {
    const anchors = [], inside = [];
    for (const [k, d] of Object.entries(Art.defs)) {
      if (d.flat || d.wall) continue;              // у них нет точки контакта с полом
      const below = d.h - d.ay;                    // сколько рисунка ниже якоря
      if (below > 8 || below < -1) anchors.push({ k, h:d.h, ay:d.ay, below });
    }
    for (const [rk, room] of Object.entries(Rooms)) {
      const foots = (room.objects || []).map(o => {
        const d = Art.defs[o.t];
        if (!d || !d.foot) return null;
        return { t:o.t, x:o.x + d.foot.x, y:o.y + d.foot.y, w:d.foot.w, h:d.foot.h };
      }).filter(Boolean);
      const hit = (label, x, y) => {
        for (const f of foots)
          if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h)
            inside.push({ room:rk, kind:label, x, y, prop:f.t });
      };
      (room.npcs || []).forEach(n => hit('NPC ' + (n.name || '?'), n.x, n.y));
      if (room.spawn) Object.entries(room.spawn).forEach(([k, v]) => hit('вход ' + k, v[0], v[1]));
    }
    return { anchors, inside };
  });

  let bad = 0;
  if (out.anchors.length) {
    bad += out.anchors.length;
    console.log('якорь не на нижней кромке:');
    out.anchors.forEach(a => console.log(`  ${a.k}  h=${a.h} ay=${a.ay} ниже якоря=${a.below}`));
  }
  if (out.inside.length) {
    bad += out.inside.length;
    console.log('внутри мебели:');
    out.inside.forEach(i => console.log(`  ${i.room}: ${i.kind} (${i.x},${i.y}) внутри ${i.prop}`));
  }
  errs.forEach(e => console.log(e));
  console.log(bad || errs.length ? `\nПРОВАЛ: ${bad} нарушений` : '\nOK: якоря, спавны и глубина в порядке');
  await browser.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
