/* Звук и атмосфера.

   Музыка синтезируется на месте, поэтому «послушать» её прогоном нельзя —
   зато можно проверить всё остальное: что у каждой темы есть ноты, что
   секвенсор реально ставит их в очередь, что плеер в меню разработчика
   играет, ставит на паузу и останавливает, что фоновые события не падают
   и у каждой комнаты есть звуковой профиль, и что время суток идёт по
   сюжету, а не стоит на месте. */
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args:['--no-sandbox','--disable-dev-shm-usage',
                                          '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport:{ width:430, height:930 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  /* Пункт 5 нарочно подсовывает несуществующий файл, и браузер честно
     пишет про него в консоль. Это ожидаемая часть проверки, а не сбой. */
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_FILE_NOT_FOUND|нет-такого-файла/.test(t)) return;
    errs.push('CONSOLE: ' + t);
  });
  await p.goto(URL); await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(800);
  const bad = [];

  /* Меню разработчика открываем первым: клик даёт жест, без которого
     браузер держит AudioContext усыплённым. */
  await p.click('#btnDevMain'); await p.waitForTimeout(400);

  /* 1. Партитуры: в каждой теме должны быть ноты на всю петлю. */
  const tracks = await p.evaluate(() => {
    const out = [];
    for (const key of Object.keys(Music.TRACKS)) {
      let notes = 0, drums = 0;
      const rv = Music.voice.bind(Music), rd = Music.drum.bind(Music);
      Music.voice = () => { notes++; }; Music.drum = () => { drums++; };
      Music.cur = key; Music.layer = 3;
      const tr = Music.TRACKS[key], perBar = tr.meter * 2, total = tr.chords.length * perBar;
      for (let s = 0; s < total; s++) Music.emit(tr, s, 0, 60 / tr.bpm / 2, perBar);
      Music.voice = rv; Music.drum = rd;
      out.push({ key, notes, drums, title: tr.title });
    }
    Music.cur = null;
    return out;
  });
  console.log('тем:', tracks.length);
  tracks.forEach(t => { if (t.notes < 6) bad.push('тема ' + t.key + ': всего ' + t.notes + ' нот'); });

  /* 1б. Темы должны отличаться друг от друга, а не играть одни и те же
     ноты разной скоростью: свой состав инструментов, свои аккорды. */
  const kits = await p.evaluate(() => Object.keys(Music.TRACKS).map(key => {
    const tr = Music.TRACKS[key];
    const kit = [...new Set(tr.voices.filter(v => (v.layer || 0) <= 1).map(v => v.i))].sort();
    const pats = tr.voices.filter(v => v.pat).map(v => v.pat);
    return { key, kit, chords: tr.chords.join(' '), bpm: tr.bpm, pats,
             base: tr.voices.filter(v => (v.layer || 0) === 0).length };
  }));
  const seen = new Map();
  for (const t of kits) {
    if (t.base < 2) bad.push('тема ' + t.key + ': на нулевом слое всего ' + t.base + ' голос(ов)');
    if (t.kit.length < 3) bad.push('тема ' + t.key + ': инструментов всего ' + t.kit.length + ' — ' + t.kit.join(','));
    const sig = t.kit.join(',') + '|' + t.chords + '|' + t.bpm;
    if (seen.has(sig)) bad.push('темы ' + seen.get(sig) + ' и ' + t.key + ' неотличимы: ' + sig);
    seen.set(sig, t.key);
  }
  console.log('составов:', kits.map(t => t.key + '[' + t.kit.join('+') + ']').join(' '));

  /* 2. Секвенсор: выбранная тема должна реально идти. */
  const grid = await p.evaluate(() => document.querySelectorAll('#devMusGrid .devBtn').length);
  console.log('кнопок в плеере:', grid);
  if (grid !== tracks.length) bad.push('в плеере ' + grid + ' кнопок, а тем ' + tracks.length);
  for (const t of tracks) {
    await p.evaluate(k => DevTools.musPlay(k), t.key);
    await p.waitForTimeout(420);
    const st = await p.evaluate(() => ({ cur:Music.cur, timer:!!Music.timer, step:Music.step }));
    if (st.cur !== t.key || !st.timer || st.step === 0)
      bad.push('тема ' + t.key + ' не играет: ' + JSON.stringify(st));
  }
  await p.click('#devMusPause'); await p.waitForTimeout(200);
  if (await p.evaluate(() => !!Music.timer)) bad.push('пауза не останавливает');
  await p.click('#devMusPlay'); await p.waitForTimeout(300);
  if (!await p.evaluate(() => !!Music.timer)) bad.push('play после паузы не запускает');
  await p.click('#devMusStop'); await p.waitForTimeout(300);
  if (await p.evaluate(() => !!Music.timer || !!Music.cur)) bad.push('стоп не сбрасывает');
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  /* 3. Фон: у каждой комнаты профиль, все события отрабатывают. */
  const amb = await p.evaluate(() => {
    const noProf = [], crashed = [], badEv = [];
    for (const k of Object.keys(Rooms)) {
      const pr = Ambience.profileFor(k, Rooms[k]);
      if (!pr || !Ambience.PROFILES[pr[0]]) noProf.push(k);
    }
    for (const [n, P] of Object.entries(Ambience.PROFILES))
      for (const [ev] of P.ev) if (!Ambience.E[ev]) badEv.push(n + ':' + ev);
    for (const [n, fn] of Object.entries(Ambience.E))
      try { fn(); } catch (e) { crashed.push(n + ' — ' + e.message); }
    return { noProf, crashed, badEv, profiles:Object.keys(Ambience.PROFILES).length,
             events:Object.keys(Ambience.E).length };
  });
  console.log('профилей %s, событий %s', amb.profiles, amb.events);
  if (amb.noProf.length)  bad.push('комнаты без звукового профиля: ' + amb.noProf.join(', '));
  if (amb.badEv.length)   bad.push('профиль ссылается на несуществующее событие: ' + amb.badEv.join(', '));
  if (amb.crashed.length) bad.push('события падают: ' + amb.crashed.join('; '));

  /* 4. Время суток: по сюжету должно темнеть, а отказ от силы — светлить. */
  const stages = await p.evaluate(() => {
    DevTools.baseUni(1); DevTools.ensureRunning();
    const test = (flags, day) => {
      for (const k in gameState.flags) gameState.flags[k] = false;
      Object.assign(gameState.flags, flags);
      setCounter('uniDay', day || 0);
      Daylight.snap();
      Weather.apply(Rooms.street);
      return { t:+Daylight.t().toFixed(2), lamp:+Daylight.lamp().toFixed(2),
               rain:+Weather.cur.rain.toFixed(2), lab:Daylight.label() };
    };
    const base = { prologueComplete:true, backstoryDone:true, mainStoryStarted:true };
    return {
      start: test(base),
      day1:  test(Object.assign({ uniArrived:true }, base), 1),
      day4:  test(Object.assign({ uniArrived:true }, base), 4),
      amulet: test(Object.assign({ firstAmulet:true }, base)),
      dead:  test(Object.assign({ sueDead:true }, base)),
      earth: test(Object.assign({ sueDead:true, sueRevived:true, chosenEarthPath:true }, base)),
    };
  });
  for (const [k, v] of Object.entries(stages))
    console.log(('  ' + k).padEnd(10) + 'время=' + v.t + '  фонари=' + v.lamp + '  дождь=' + v.rain + '  ' + v.lab);
  if (!(stages.start.t < stages.day4.t && stages.day4.t < stages.dead.t))
    bad.push('время суток не темнеет вместе с сюжетом');
  if (!(stages.earth.t < stages.amulet.t))
    bad.push('отказ от силы не возвращает свет');
  if (!(stages.start.lamp === 0 && stages.dead.lamp > 0.9))
    bad.push('фонари не реагируют на время суток');
  if (!(stages.start.rain < stages.dead.rain))
    bad.push('дождь не усиливается к финалу');

  /* 5. Отсутствующий аудиофайл не должен ломать игру. */
  const survived = await p.evaluate(async () => {
    try {
      Music.useFiles({ home:'нет-такого-файла.mp3' });
      Music.cur = null; Music.play('home');
      await new Promise(r => setTimeout(r, 400));
      Music.FILES = {};
      return true;
    } catch (e) { return String(e); }
  });
  if (survived !== true) bad.push('отсутствующий файл ломает музыку: ' + survived);

  await b.close();
  errs.forEach(e => { console.log(e); bad.push(e); });
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: музыка, фон и время суток на месте');
})();
