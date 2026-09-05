/* Сказ о Мидее: игрок должен увидеть, как собирается существо, как оно
   уходит, и как Мидею казнят — а не только прочитать об этом. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{width:420,height:860} });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#btnNew'); await p.waitForTimeout(700);
  const seen = { gather:0, form:0, free:0, fall:0 };
  let shotForm=false, shotFall=false, g=0;
  while (g++ < 1400) {
    const st = await p.evaluate(()=>({ room: gameState && gameState.currentRoom, dlg: Dialogue.active,
      n: document.querySelectorAll('#choiceOptions .choiceOpt').length,
      hint: document.getElementById('titleHint').classList.contains('show'),
      ph: Prologue.creature ? Prologue.creature.phase : null,
      fall: Prologue.fall, zoom: Game.zoom }));
    if (st.room === 'playground') break;
    if (st.ph && seen[st.ph] !== undefined) seen[st.ph]++;
    if (st.fall > 0) seen.fall++;
    if (st.ph === 'form' && !shotForm && process.argv[2]) { shotForm = true; await p.waitForTimeout(700);
      await p.locator('#gameCanvas').screenshot({ path: process.argv[2] }); }
    if (st.fall > .4 && st.fall < .9 && !shotFall && process.argv[3]) { shotFall = true;
      await p.locator('#gameCanvas').screenshot({ path: process.argv[3] }); }
    if (st.hint) { await p.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown'))); await p.waitForTimeout(140); continue; }
    if (st.n) { await p.evaluate(()=>document.querySelectorAll('#choiceOptions .choiceOpt')[0].click()); await p.waitForTimeout(150); continue; }
    if (st.dlg) { await p.evaluate(()=>Dialogue.advance()); await p.waitForTimeout(40); continue; }
    await p.waitForTimeout(60);
  }
  console.log('кадров по фазам:', JSON.stringify(seen));
  console.log(errs.length ? 'ERRORS ' + errs.slice(0,2).join(' | ') : 'без ошибок');
  await b.close();
  const ok = seen.gather > 0 && seen.form > 0 && seen.free > 0 && seen.fall > 0 && !errs.length;
  console.log(ok ? 'OK: создание существа и гибель Мидеи отыграны на экране'
                 : 'ПРОВАЛ: сказ о Мидее не показан');
  process.exit(ok ? 0 : 1);
})();
