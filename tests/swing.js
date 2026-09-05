const path = require('path');
/* Сцена на качелях: проверяем, что Сью действительно летит, а не
   телепортируется, что фазы идут по порядку и что камешки с бабочкой
   успевают отработать до затемнения. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{width:420,height:860} });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForTimeout(500);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('#btnNew'); await p.waitForTimeout(700);
  // проматываем ад до площадки
  let g=0;
  while (g++ < 900) {
    const st = await p.evaluate(()=>({ room: gameState && gameState.currentRoom, dlg: Dialogue.active,
      scene: Scene.active, mode: Game.mode, n: document.querySelectorAll('#choiceOptions .choiceOpt').length,
      hint: document.getElementById('titleHint').classList.contains('show') }));
    if (st.room === 'playground' && !st.scene && st.mode === 'explore') break;
    if (st.hint) { await p.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerdown'))); await p.waitForTimeout(140); continue; }
    if (st.n) { await p.evaluate(()=>document.querySelectorAll('#choiceOptions .choiceOpt')[0].click()); await p.waitForTimeout(150); continue; }
    if (st.dlg) { await p.evaluate(()=>Dialogue.advance()); await p.waitForTimeout(10); continue; }
    await p.waitForTimeout(60);
  }
  // запускаем качели и снимаем траекторию
  const samples = [];
  await p.evaluate(()=>{ const r=Rooms.playground; const o=r.interactables.find(x=>x.name==='swing');
    Player.x=o.x+o.w/2; Player.y=o.y+o.h/2+6; doInteract(); });
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const s = await p.evaluate(()=>({
      ph: Prologue.swing ? Prologue.swing.phase : null,
      done: Prologue.swing ? Prologue.swing.done : null,
      x: Math.round(Player.x), y: Math.round(Player.y), lift: Math.round(Player.lift||0),
      stones: Prologue.stones.length, bfly: !!Prologue.butterfly,
      dlg: Dialogue.active, complete: gameState && gameState.flags.prologueComplete,
      room: gameState && gameState.currentRoom,
    }));
    samples.push(s);
    if (s.complete) break;
    if (s.dlg) await p.evaluate(()=>Dialogue.advance());
    await p.waitForTimeout(90);
  }
  const byPhase = {};
  samples.forEach(s => { if (!s.ph) return; (byPhase[s.ph] = byPhase[s.ph] || []).push(s); });
  for (const [ph, arr] of Object.entries(byPhase)) {
    const ys = arr.map(a=>a.y), ls = arr.map(a=>a.lift);
    console.log(`${ph.padEnd(7)} кадров=${String(arr.length).padStart(3)}  y ${Math.min(...ys)}..${Math.max(...ys)}  подъём ${Math.min(...ls)}..${Math.max(...ls)}`);
  }
  const jumps = [];
  for (let i=1;i<samples.length;i++) {
    const d = Math.hypot(samples[i].x - samples[i-1].x, samples[i].y - samples[i-1].y);
    if (d > 26) jumps.push(`${samples[i-1].x},${samples[i-1].y} -> ${samples[i].x},${samples[i].y} (${d|0}px, фаза ${samples[i].ph})`);
  }
  console.log('камешков максимум:', Math.max(...samples.map(s=>s.stones)));
  console.log('бабочка появлялась:', samples.some(s=>s.bfly));
  console.log('телепортаций (>26px за кадр):', jumps.length, jumps.slice(0,3).join(' | '));
  console.log('пролог завершён:', samples[samples.length-1].complete, 'комната:', samples[samples.length-1].room);
  console.log(errs.length ? 'ERRORS ' + errs.slice(0,3).join(' | ') : 'без ошибок');
  await b.close();
  const last = samples[samples.length-1] || {};
  const phases = Object.keys(byPhase);
  const need = ['sit','push','launch','fly','hold','float','land'];
  const missing = need.filter(x => !phases.includes(x));
  const ok = !missing.length && !jumps.length && last.complete
             && Math.max(...samples.map(s=>s.stones)) > 0
             && samples.some(s=>s.bfly) && !errs.length;
  if (missing.length) console.log('не отыграны фазы:', missing.join(', '));
  console.log(ok ? 'OK: сцена отыграна без телепортаций' : 'ПРОВАЛ: сцена на качелях');
  process.exit(ok ? 0 : 1);
})();
