/* Смена в кафе: харнесс отыгрывает четыре заказа как игрок, изредка нажимая
   заведомо не то — порча заказа не должна ломать смену. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{width:420,height:860} });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#btnNew'); await p.waitForTimeout(900);
  await p.evaluate(()=>{ Dialogue.active=false; Scene.active=false; Game.mode='explore';
    document.getElementById('dialogueBox').classList.remove('active');
    document.getElementById('fade').classList.remove('show');
    Shift.run().then(()=>{ window.__shiftDone = true; }); });
  await p.waitForTimeout(500);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2], clip:{x:0,y:0,width:420,height:600} });

  let guard = 0, wrong = 0;
  while (guard++ < 400) {
    const st = await p.evaluate(() => {
      if (window.__shiftDone) return { done:true };
      const recipe = document.getElementById('shiftRecipe').textContent;
      const tray = [...document.querySelectorAll('#shiftTray span')].map(s=>s.textContent);
      const btns = [...document.querySelectorAll('.shiftBtn')].map(b=>b.textContent);
      return { done:false, recipe, tray, btns, phase: document.getElementById('shiftPhase').textContent };
    });
    if (st.done) break;
    const steps = st.recipe.split(': ')[1] ? st.recipe.split(': ')[1].split(' → ') : [];
    const want = steps[st.tray.length];
    if (!want) { await p.waitForTimeout(200); continue; }
    // раз в 7 шагов жмём заведомо не то — проверяем, что порча заказа не ломает игру
    const idx = (guard % 31 === 0) ? st.btns.findIndex(t => t !== want) : st.btns.indexOf(want);
    if (guard % 31 === 0 && idx >= 0) wrong++;
    if (idx < 0) { await p.waitForTimeout(150); continue; }
    await p.evaluate(i => document.querySelectorAll('.shiftBtn')[i].click(), idx);
    await p.waitForTimeout(180);
  }
  const st = await p.evaluate(()=>({ done: !!window.__shiftDone, started: gameState.flags.cafeShiftStarted,
    finished: gameState.flags.cafeShiftFinished, progress: gameState.counters.cafeMinigameProgress,
    vis: document.getElementById('shiftScreen').classList.contains('show') }));
  console.log('итог:', JSON.stringify(st), 'намеренных ошибок:', wrong, 'шагов:', guard);
  console.log(errs.length ? 'ERRORS ' + errs.slice(0,3).join(' | ') : 'без ошибок');
  await b.close();
  const ok = st.done && st.finished && st.progress === 4 && !st.vis && !errs.length;
  console.log(ok ? 'OK: смена отыграна целиком' : 'ПРОВАЛ: смена не завершилась');
  process.exit(ok ? 0 : 1);
})();
