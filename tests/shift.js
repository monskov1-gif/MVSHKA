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
  while (guard++ < 900) {
    const r = await p.evaluate((doWrong) => {
      if (window.__shiftDone) return 'done';
      const S = Shift;
      if (S.brewing) return 'brew';
      const q = S.queue.find(x => S.tray.every((t, i) => x.r.steps[i] === t));
      if (!q) { S.spoil(); return 'reset'; }
      if (doWrong) {                                   // намеренная ошибка: чужой ингредиент
        const bad = Object.keys(S.T).find(t => t !== q.r.steps[S.tray.length] && t !== 'brew');
        if (bad) { S.tapToken(bad); return 'wrong'; }
      }
      if (S.tray.length === q.r.steps.length) { S.serveIndex(S.queue.indexOf(q)); return 'serve'; }
      S.tapToken(q.r.steps[S.tray.length]);
      return 'step';
    }, guard % 37 === 0);
    if (r === 'done') break;
    if (r === 'wrong') wrong++;
    await p.waitForTimeout(r === 'brew' ? 200 : 70);
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
