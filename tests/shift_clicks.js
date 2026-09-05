/* Проверяем мини-игру так, как в неё играет человек: читаем экран, ищем
   кнопку с нужным названием и жмём по её координатам через реальный клик. */
/* Мини-игра глазами игрока: настоящие клики по координатам кнопок на
   канвасе. Ловит именно ту поломку, из-за которой верный ингредиент
   превращался в неверный — прыгающие станции. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{width:420,height:860} });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#btnNew'); await p.waitForTimeout(900);
  await p.evaluate(()=>{ Dialogue.active=false; Scene.active=false; Game.mode='explore';
    document.getElementById('dialogueBox').classList.remove('active');
    document.getElementById('fade').classList.remove('show');
    Shift.run().then(()=>{ window.__done = true; }); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{ window.__log=[]; const orig = Shift.spoil.bind(Shift);
    Shift.spoil = function(m){ window.__log.push({tray:[...Shift.tray], q:Shift.queue.map(x=>x.r.name), msg:m||''}); return orig(m); }; });

  // 1. станции не должны меняться между кадрами
  const a = await p.evaluate(()=>Shift.stations().join(','));
  await p.waitForTimeout(700);
  const b2 = await p.evaluate(()=>Shift.stations().join(','));
  console.log('станции стабильны:', a === b2, a === b2 ? '' : `${a} -> ${b2}`);

  let spoils = 0, served = 0, guard = 0;
  while (guard++ < 500) {
    const st = await p.evaluate(()=>{
      if (window.__done) return {done:true};
      const S = Shift;
      if (S.brewing) return {brew:true};
      const q = S.queue.find(x => S.tray.every((t,i)=>x.r.steps[i]===t));
      if (!q) return {stuck:true};
      const want = S.tray.length === q.r.steps.length ? null : q.r.steps[S.tray.length];
      const gi = S.queue.indexOf(q);
      // координаты кнопки/гостя на канвасе -> координаты страницы
      const cv = document.getElementById('shiftCanvas'), r = cv.getBoundingClientRect();
      const toPage = h => ({ x: r.left + (h.x + h.w/2) / 240 * r.width,
                             y: r.top  + (h.y + h.h/2) / 340 * r.height });
      if (!want) { const h = S.hit.find(h=>h.kind==='guest' && h.i===gi);
                   return h ? { tap: toPage(h), serve:true } : {stuck:true}; }
      const h = S.hit.find(h=>h.kind==='st' && h.t===want);
      return h ? { tap: toPage(h), token:want } : {stuck:true};
    });
    if (st.done) break;
    if (st.brew) { await p.waitForTimeout(220); continue; }
    if (st.stuck) { await p.waitForTimeout(160); continue; }
    const before = await p.evaluate(()=>({t:Shift.tray.length, s:Shift.served}));
    await p.mouse.click(st.tap.x, st.tap.y);
    await p.waitForTimeout(120);
    const after = await p.evaluate(()=>({t:Shift.tray.length, s:Shift.served, f:Shift.flash}));
    if (st.serve) { if (after.s > before.s) served++; else spoils++; }
    else if (after.t !== before.t + 1) spoils++;
  }
  const fin = await p.evaluate(()=>({done:!!window.__done, served:Shift.served,
    finished: gameState.flags.cafeShiftFinished, vis:document.getElementById('shiftScreen').classList.contains('show')}));
  console.log('верных нажатий отменено:', spoils, '| выдано заказов:', served, '| итог:', JSON.stringify(fin));
  const log = await p.evaluate(()=>window.__log);
  log.slice(0,6).forEach(l=>console.log('  порча:', JSON.stringify(l)));
  console.log(errs.length ? 'ERRORS '+errs.slice(0,2).join(' | ') : 'без ошибок');
  await b.close();
  const ok = log.length === 0 && fin.done && fin.finished && !fin.vis && !errs.length;
  console.log(ok ? 'OK: смена проходится кликами, верные нажатия не отменяются'
                 : 'ПРОВАЛ: мини-игра портит верные заказы');
  process.exit(ok ? 0 : 1);
})();
