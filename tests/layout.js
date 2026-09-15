/* АДАПТАЦИЯ ПОД ЭКРАН.

   Проверяется не «CSS выглядит нормально», а измеримое: канва не
   растянута и не вылезла за сцену, интерфейс внутри экрана, кнопки не
   меньше пальца, текст не выходит за плашку, поворот не ломает игру.

   Прогоняется на десяти размерах из задания плюс горизонтальный
   телефон, и в трёх состояниях: обычная ходьба, диалог, выбор. */
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const SIZES = [
  [320, 568], [360, 800], [390, 844], [430, 932], [600, 960],
  [768, 1024], [1024, 768], [1280, 720], [1920, 1080], [2560, 1080], [844, 390],
];
/* Минимальная сторона кнопки под палец. Рекомендация — 44 CSS-пикселя;
   на экране в 320 точек столько не выкроить, поэтому там мягче. */
const TOUCH = (w, h) => (Math.min(w, h) < 360 ? 34 : 42);

(async () => {
  const bad = [];
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  for (const [W, H] of SIZES) {
    const tag = `${W}×${H}`;
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.goto(URL);
    await p.waitForFunction(() => typeof DevTools !== 'undefined');
    await p.evaluate(async () => {
      localStorage.clear();
      DevTools.baseUni(2); DevTools.ensureRunning();
      await DevTools.teleport('uniHall');
      UI.updateInventory(); Quests.refresh(false);
    });
    await p.waitForTimeout(450);

    const m = await p.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect();
        return { x:r.left, y:r.top, w:r.width, h:r.height, r:r.right, b:r.bottom }; };
      const c = document.getElementById('gameCanvas');
      const out = {
        screen: [innerWidth, innerHeight],
        canvas: box(c), logical: [c.width, c.height],
        stage: Screen.stage, mode: Screen.mode, unit: Screen.unit, band: Screen.band,
        el: {},
      };
      for (const id of ['dpad', 'actionBtn', 'menuBtnGame', 'statusBtnGame', 'questPanel', 'inventoryPanel'])
        out.el[id] = box(document.getElementById(id));
      return out;
    });

    const say = s => bad.push(tag + ': ' + s);
    /* 1. Мир не растянут: пиксель квадратный. */
    const sx = m.canvas.w / m.logical[0], sy = m.canvas.h / m.logical[1];
    if (Math.abs(sx - sy) / Math.max(sx, sy) > 0.015)
      say(`канва растянута: по X ×${sx.toFixed(3)}, по Y ×${sy.toFixed(3)}`);
    /* 2. Канва внутри отведённой сцены. */
    if (m.canvas.x < -1 || m.canvas.y < -1 || m.canvas.r > m.screen[0] + 1 || m.canvas.b > m.screen[1] + 1)
      say(`канва вылезла за экран: ${Math.round(m.canvas.x)},${Math.round(m.canvas.y)} ` +
          `${Math.round(m.canvas.w)}×${Math.round(m.canvas.h)}`);
    /* 3. Чёрных полей не больше четверти экрана по каждой оси. */
    const gapX = (m.screen[0] - m.canvas.w) / m.screen[0];
    const gapY = (m.screen[1] - m.canvas.h - m.band) / m.screen[1];
    if (gapX > 0.25) say(`чёрные поля по бокам: ${Math.round(gapX * 100)}% ширины`);
    if (gapY > 0.25) say(`чёрные поля сверху/снизу: ${Math.round(gapY * 100)}% высоты`);
    /* 4. Ничего не торчит за экран и кнопки под палец. */
    const need = TOUCH(W, H);
    for (const [id, r] of Object.entries(m.el)) {
      if (!r.w || !r.h) continue;
      if (r.x < -1 || r.y < -1 || r.r > m.screen[0] + 1 || r.b > m.screen[1] + 1)
        say(`${id} за краем экрана: ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`);
      if (['dpad', 'actionBtn', 'menuBtnGame', 'statusBtnGame'].includes(id) && Math.min(r.w, r.h) < need)
        say(`${id} мельче пальца: ${Math.round(r.w)}×${Math.round(r.h)} при минимуме ${need}`);
    }
    /* 5. Кнопки не налезают друг на друга. */
    const hit = (a, c) => a.x < c.r && c.x < a.r && a.y < c.b && c.y < a.b;
    if (hit(m.el.dpad, m.el.actionBtn)) say('джойстик и кнопка действия перекрываются');
    if (hit(m.el.menuBtnGame, m.el.statusBtnGame)) say('верхние кнопки перекрываются');
    if (hit(m.el.questPanel, m.el.menuBtnGame)) say('цель налезает на верхние кнопки');

    /* 6. Диалог: текст внутри плашки, плашка внутри экрана. */
    await p.evaluate(() => Dialogue.start([{ who:'naya', expr:'normal',
      text:'Очень длинная реплика, которая обязана поместиться в плашку целиком и на узком экране, и на широком, и при увеличенном игроком тексте.' }]));
    await p.waitForTimeout(700);
    const d = await p.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect();
        return { x:r.left, y:r.top, w:r.width, h:r.height, r:r.right, b:r.bottom }; };
      const bx = document.getElementById('dialogueBox'), tx = document.getElementById('dialogueText');
      return { box: box(bx), text: box(tx), over: tx.scrollHeight - tx.clientHeight,
               screen: [innerWidth, innerHeight] };
    });
    if (d.box.x < -1 || d.box.r > d.screen[0] + 1 || d.box.b > d.screen[1] + 1)
      say(`плашка диалога за краем: ${Math.round(d.box.x)},${Math.round(d.box.y)} ${Math.round(d.box.w)}×${Math.round(d.box.h)}`);
    if (d.over > 1) say(`текст не помещается в плашку диалога: лишних ${d.over}px`);

    /* 7. Выборы. */
    await p.evaluate(() => {
      Dialogue.active = false;
      document.getElementById('dialogueBox').classList.remove('active');
      Dialogue.start([{ choice: { prompt:'Что делать?', options:[
        { text:'Первый вариант, довольно длинный, чтобы проверить перенос строки' },
        { text:'Второй' }, { text:'Третий' } ] } }]);
    });
    await p.waitForTimeout(500);
    const ch = await p.evaluate(() => {
      const r = document.getElementById('choiceBox').getBoundingClientRect();
      const opts = [...document.querySelectorAll('.choiceOpt')].map(o => {
        const q = o.getBoundingClientRect();
        return { h:q.height, over:o.scrollHeight - o.clientHeight, b:q.bottom, x:q.left, r:q.right };
      });
      return { box:{ x:r.left, y:r.top, r:r.right, b:r.bottom }, opts, screen:[innerWidth, innerHeight] };
    });
    if (ch.box.x < -1 || ch.box.r > ch.screen[0] + 1)
      say('панель выбора за краем экрана');
    ch.opts.forEach((o, i) => {
      if (o.over > 1) say(`вариант ${i + 1}: текст не помещается (лишних ${o.over}px)`);
      if (o.h < need * 0.9) say(`вариант ${i + 1} мельче пальца: ${Math.round(o.h)}px`);
    });

    console.log(`${tag.padEnd(10)} режим=${m.mode.padEnd(9)} ед=${m.unit.toFixed(1)} ` +
                `кадр=${m.logical.join('×')} канва=${Math.round(m.canvas.w)}×${Math.round(m.canvas.h)} ` +
                `×${sx.toFixed(2)} полоса=${m.band}`);
    errs.forEach(e => say(e));
    await p.close();
  }

  /* 8. Поворот на лету: комната, игрок и диалог переживают смену. */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await p.goto(URL);
    await p.waitForFunction(() => typeof DevTools !== 'undefined');
    await p.evaluate(async () => {
      localStorage.clear(); DevTools.baseUni(2); DevTools.ensureRunning();
      await DevTools.teleport('uniLibrary');
    });
    await p.waitForTimeout(400);
    const before = await p.evaluate(() => ({ room:gameState.currentRoom, x:Player.x, y:Player.y, running:Game.running }));
    for (const [w, h] of [[844, 390], [1280, 720], [390, 844], [360, 1400]]) {
      await p.setViewportSize({ width: w, height: h });
      await p.waitForTimeout(320);
      const now = await p.evaluate(() => ({
        room:gameState.currentRoom, x:Player.x, y:Player.y, running:Game.running,
        cw:Game.canvas.width, ch:Game.canvas.height,
        lit:(() => { const c=document.getElementById('gameCanvas');
          const g=c.getContext('2d',{willReadFrequently:true});
          try { const d=g.getImageData(0,0,c.width,c.height).data; let lit=0,n=0;
            for (let i=0;i<d.length;i+=4*53){n++; if(d[i]+d[i+1]+d[i+2]>24) lit++;} return n?lit/n:0;
          } catch(e) { return -1; } })(),
      }));
      if (now.room !== before.room) bad.push(`поворот ${w}×${h}: комната сменилась на ${now.room}`);
      if (Math.abs(now.x - before.x) > 0.6 || Math.abs(now.y - before.y) > 0.6)
        bad.push(`поворот ${w}×${h}: игрока телепортировало`);
      if (!now.running) bad.push(`поворот ${w}×${h}: игровой цикл встал`);
      if (now.lit >= 0 && now.lit < 0.25) bad.push(`поворот ${w}×${h}: кадр почти чёрный (${Math.round(now.lit*100)}%)`);
      console.log(`поворот ${String(w + '×' + h).padEnd(10)} кадр=${now.cw}×${now.ch} видно=${Math.round(now.lit*100)}%`);
    }
    errs.forEach(e => bad.push('поворот: ' + e));
    await p.close();
  }

  /* 9. Настройки отображения: живое применение, совпадение с превью,
     границы перетаскивания, сохранение и сброс. */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    await p.goto(URL);
    await p.waitForFunction(() => typeof DevTools !== 'undefined');
    await p.evaluate(async () => {
      localStorage.clear(); DevTools.baseUni(2); DevTools.ensureRunning();
      await DevTools.teleport('uniHall');
    });
    await p.waitForTimeout(350);
    const before = await p.evaluate(() => document.getElementById('dpad').getBoundingClientRect().width);

    await p.evaluate(() => { Game.paused = true; Display.open(); });
    await p.waitForTimeout(350);
    await p.evaluate(() => { const s = document.getElementById('rngMove'); s.value = 150;
      s.dispatchEvent(new Event('input', { bubbles:true })); s.dispatchEvent(new Event('change', { bubbles:true })); });
    await p.waitForTimeout(250);

    const live = await p.evaluate(() => ({
      real: document.getElementById('dpad').getBoundingClientRect().width,
      prev: document.querySelector('#dspScreen .pvDpad').getBoundingClientRect().width,
      k: Display.scale,
    }));
    if (Math.abs(live.real - before * 1.5) > 2)
      bad.push(`ползунок движения: в игре ${Math.round(live.real)}px вместо ${Math.round(before*1.5)}px`);
    /* Главная проверка всей затеи: превью и игра — одна система. */
    if (Math.abs(live.prev / live.k - live.real) > 2)
      bad.push(`превью разошлось с игрой: ${(live.prev/live.k).toFixed(1)} против ${live.real.toFixed(1)}`);

    /* Перетаскивание не должно выносить кнопку за экран. */
    await p.evaluate(() => Display.setMoving(true));
    await p.waitForTimeout(150);
    for (const [dx, dy] of [[600, -600], [-600, 600], [600, 600]]) {
      const c = await p.evaluate(() => { const r = document.querySelector('#dspScreen .pvDpad').getBoundingClientRect();
        return { x:r.left + r.width/2, y:r.top + r.height/2 }; });
      await p.mouse.move(c.x, c.y); await p.mouse.down();
      await p.mouse.move(c.x + dx, c.y + dy, { steps: 6 }); await p.mouse.up();
      await p.waitForTimeout(160);
      const r = await p.evaluate(() => { const q = document.getElementById('dpad').getBoundingClientRect();
        return { x:q.left, y:q.top, r:q.right, b:q.bottom, W:innerWidth, H:innerHeight }; });
      if (r.x < -1 || r.y < -1 || r.r > r.W + 1 || r.b > r.H + 1)
        bad.push(`перетаскивание вынесло джойстик за экран: ${Math.round(r.x)},${Math.round(r.y)}`);
    }

    /* Сохранение переживает перезагрузку. */
    await p.evaluate(() => UIScale.save());
    await p.reload(); await p.waitForTimeout(700);
    const kept = await p.evaluate(() => UIScale.get('move'));
    if (Math.abs(kept - 1.5) > 0.01) bad.push(`настройки не сохранились: движение ${kept}`);

    /* Сброс возвращает всё к стандартному. */
    await p.evaluate(() => UIScale.reset());
    await p.waitForTimeout(200);
    const reset = await p.evaluate(() => ({ v: JSON.stringify(UIScale.val), p: JSON.stringify(UIScale.pos) }));
    if (reset.v !== JSON.stringify({ ui:1, move:1, btn:1, top:1, text:1, panel:1 }))
      bad.push('сброс не вернул размеры: ' + reset.v);
    if (reset.p !== JSON.stringify({ dpadX:0, dpadY:0, actX:0, actY:0 }))
      bad.push('сброс не вернул расположение: ' + reset.p);

    console.log(`настройки: ползунок 150%% -> ${Math.round(live.real)}px в игре, ` +
                `превью совпало, перетаскивание в границах, сохранение и сброс работают`);
    errs.forEach(e => bad.push('настройки: ' + e));
    await p.close();
  }

  await b.close();
  if (bad.length) {
    console.log('\nПРОБЛЕМЫ:');
    [...new Set(bad)].forEach(x => console.log('  ' + x));
    process.exit(1);
  }
  console.log('\nOK: игра адаптируется на всех проверенных экранах');
})();
