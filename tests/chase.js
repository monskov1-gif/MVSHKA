/* ПОГОНЯ КАК МИНИ-ИГРА.

   Проверяется не «экран открылся», а то, ради чего она сделана:
   препятствия появляются и разных видов, столкновение отнимает отрыв,
   бездействие кончается поимкой, а осмысленная игра — побегом. И то и
   другое должно закрывать экран и возвращать игру в explore. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const bad = [];
  const b = await chromium.launch({ executablePath:CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport:{ width:520, height:900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => typeof DevTools !== 'undefined');

  const boot = async () => {
    await p.evaluate(async () => {
      localStorage.clear(); DevTools.baseUni(2); DevTools.ensureRunning();
      await DevTools.teleport('street'); Audio.init();
      gameState.flags.chaseHelpSeen = true;
    });
    await p.waitForTimeout(300);
    await p.evaluate(() => { ChaseRun.run(); });
    await p.waitForSelector('#chaseScreen.show', { timeout:8000 });
    await p.evaluate(() => ChaseRun.help(false));
  };

  /* 1. Экран, полосы, управление. */
  await boot();
  const start = await p.evaluate(() => ({ mode:Game.mode, lane:ChaseRun.lane, lanes:ChaseRun.LANES,
                                          t:ChaseRun.t, gap:ChaseRun.gap }));
  console.log('старт:', JSON.stringify(start));
  if (start.mode !== 'chase') bad.push('режим не chase: ' + start.mode);
  if (start.lane !== 1) bad.push('старт не со средней полосы');

  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(120);
  let lane = await p.evaluate(() => ChaseRun.lane);
  if (lane !== 0) bad.push('стрелка вверх не сменила полосу: ' + lane);
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(120);
  if (await p.evaluate(() => ChaseRun.lane) !== 0) bad.push('полоса ушла выше верхней');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150);
  lane = await p.evaluate(() => ChaseRun.lane);
  if (lane !== 2) bad.push('полоса не дошла до нижней: ' + lane);

  /* 2. Препятствия появляются, и не одного вида. */
  const kinds = new Set();
  for (let i = 0; i < 60; i++) {
    const ks = await p.evaluate(() => ChaseRun.obs.map(o => o.k));
    ks.forEach(k => kinds.add(k));
    await p.waitForTimeout(220);
    if (kinds.size >= 3) break;
  }
  console.log('виды препятствий:', [...kinds].join(', '));
  if (kinds.size < 2) bad.push('за полминуты встретилось меньше двух видов препятствий');

  /* 3. Столкновение отнимает отрыв и роняет Наю. */
  const hit = await p.evaluate(() => {
    const before = ChaseRun.gap;
    ChaseRun.knock({ say:'Тест.' });
    return { before, after:ChaseRun.gap, stumble:ChaseRun.stumble, hits:ChaseRun.hits };
  });
  console.log('столкновение:', JSON.stringify(hit));
  if (!(hit.after < hit.before)) bad.push('удар не сократил отрыв');
  if (!(hit.stumble > 0)) bad.push('после удара Ная не падает');

  /* 4. Бездействие = поимка. */
  await p.evaluate(() => { ChaseRun.gap = 4; ChaseRun.stumble = 900; });
  await p.waitForTimeout(1600);
  let out = await p.evaluate(() => ({ shown:document.getElementById('chaseScreen').classList.contains('show'),
                                      escaped:F('lonerEscaped'), mode:Game.mode, raf:ChaseRun.raf }));
  console.log('поймали:', JSON.stringify(out));
  if (out.shown)   bad.push('после поимки экран не закрылся');
  if (out.escaped) bad.push('поимка записалась как побег');
  if (out.mode !== 'explore') bad.push('после поимки режим ' + out.mode);
  if (out.raf) bad.push('цикл погони не остановлен после поимки');

  /* 5. Дожили до конца = побег. */
  await boot();
  await p.evaluate(() => { ChaseRun.t = 700; });
  await p.waitForTimeout(1600);
  out = await p.evaluate(() => ({ shown:document.getElementById('chaseScreen').classList.contains('show'),
                                  escaped:F('lonerEscaped'), mode:Game.mode, raf:ChaseRun.raf }));
  console.log('ушла:', JSON.stringify(out));
  if (out.shown)    bad.push('после побега экран не закрылся');
  if (!out.escaped) bad.push('побег не записался');
  if (out.raf) bad.push('цикл погони не остановлен после побега');

  /* 6. Кадр не чёрный: дорога и фигуры реально рисуются. */
  await boot();
  await p.waitForTimeout(800);
  const paint = await p.evaluate(() => {
    const c = document.getElementById('chaseCanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0, tones = new Set();
    for (let i = 0; i < d.length; i += 4 * 37) {
      const v = d[i] + d[i+1] + d[i+2];
      if (v > 60) lit++;
      tones.add((d[i] >> 5) + ',' + (d[i+1] >> 5) + ',' + (d[i+2] >> 5));
    }
    return { lit, tones:tones.size };
  });
  console.log('кадр: непустых точек', paint.lit, '· оттенков', paint.tones);
  if (paint.lit < 200) bad.push('кадр погони почти пустой');
  if (paint.tones < 8) bad.push('кадр погони одноцветный: оттенков ' + paint.tones);
  await p.evaluate(() => ChaseRun.finish(true));

  await b.close();
  errs.forEach(e => { console.log(e); bad.push(e); });
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: погоня играется, сбивает с ног и кончается обоими способами');
})();
