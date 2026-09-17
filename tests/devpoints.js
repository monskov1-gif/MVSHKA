/* СЮЖЕТНЫЕ ТОЧКИ МЕНЮ РАЗРАБОТЧИКА.

   Прыжок в главу должен давать состояние, которое бывает в игре. Иначе
   получается то, с чего этот тест и начался: переносимся в главу после
   расследования, приходим к Женевьеве домой — а она встречает репликой
   «мы ещё не знакомы, найди меня в университете».

   Проверяется каждая точка: что магистраль сюжета непрерывна (нет
   позднего флага без раннего), что развилки не выставлены обе разом,
   что цель осмысленная и что ключевые NPC узнают Наю. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

(async () => {
  const bad = [];
  const b = await chromium.launch({ executablePath:CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{ width:520, height:900 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(URL);
  await p.waitForFunction(() => typeof DevTools !== 'undefined');

  const points = await p.evaluate(() =>
    DevTools.storyPoints.map(x => ({ id:x.id, ch:String(x.ch), title:x.title })));
  console.log('точек в меню:', points.length);

  for (const pt of points) {
    const r = await p.evaluate(async id => {
      const point = DevTools.storyPoints.find(x => x.id === id);
      localStorage.clear();
      await DevTools.applyPoint(point);
      const f = gameState.flags;

      /* Магистраль: после самой поздней достигнутой вехи не должно
         остаться дыр перед ней. */
      const ML = DevTools.MAINLINE;
      let last = -1;
      ML.forEach((k, i) => { if (f[k]) last = i; });
      const holes = ML.slice(0, last + 1).filter(k => !f[k]);

      /* Взаимоисключающие пары. */
      const both = [];
      if (f.sueAgreed && f.sueRefused)   both.push('sueAgreed+sueRefused');
      if (f.sueRevived && f.sueLeftDead) both.push('sueRevived+sueLeftDead');
      if (f.chosenWitchPath && f.chosenEarthPath) both.push('witchPath+earthPath');

      const goal = Quests.goal();
      return {
        room: gameState.currentRoom, holes, both,
        lastMile: last >= 0 ? ML[last] : '(нет)',
        goal: goal ? goal.t : null,
        found: !!f.foundGenevieve, invited: !!f.communeInvite,
        uniDay: gameState.counters.uniDay,
        dead: !!f.sueDead,
        branch: Object.keys(f).some(k => k.startsWith('loner') && f[k]) ? 'loner'
              : Object.keys(f).some(k => k.startsWith('evil')  && f[k]) ? 'evil' : '',
      };
    }, pt.id);
    await p.waitForTimeout(90);

    const tag = `${pt.ch.padEnd(8)} ${pt.id.padEnd(20)}`;
    console.log(`${tag} ${String(r.room).padEnd(14)} веха=${String(r.lastMile).padEnd(16)} цель=${r.goal}`);
    if (r.holes.length) bad.push(`${pt.id}: дыры в магистрали — ${r.holes.join(', ')}`);
    if (r.both.length)  bad.push(`${pt.id}: обе стороны развилки — ${r.both.join(', ')}`);
    if (!r.goal)        bad.push(`${pt.id}: нет текущей цели`);
    if (r.invited && !r.found)
      bad.push(`${pt.id}: позвали в коммуну, но Женевьева не знакома`);
    /* Цель обязана принадлежать той же ветке, что и точка. Точка
       одиночки стояла на состоянии десятой главы, и цель читалась
       «Идти в коммуну. Одной.» — из ветки злой Наи. */
    if (r.branch === 'loner') {
      if (r.dead)  bad.push(`${pt.id}: ветка одиночки, а Сью мертва`);
      if (/коммуну\. Одной/.test(r.goal || ''))
        bad.push(`${pt.id}: цель из чужой ветки — «${r.goal}»`);
    }
    if (r.branch === 'evil' && !r.dead)
      bad.push(`${pt.id}: ветка злой Наи, а Сью жива`);
  }

  /* Женевьева не должна отправлять в университет того, кто его прошёл. */
  console.log('\nЖеневьева у себя дома:');
  for (const id of ['gen_house', 'hell_first', 'after_hell', 'commune_first', 'amulet1', 'sue_dead']) {
    const line = await p.evaluate(async id => {
      const point = DevTools.storyPoints.find(x => x.id === id);
      localStorage.clear();
      await DevTools.applyPoint(point);
      await DevTools.teleport('genLiving');
      const np = (Rooms.genLiving.npcs || []).filter(n => !n.when || n.when())
                 .find(n => n.name === 'Женевьева');
      if (!np) return '(нет в комнате)';
      const said = [];
      const orig = Dialogue.start.bind(Dialogue);
      const origScene = Scene.play.bind(Scene);
      Dialogue.start = (l, cb) => { (Array.isArray(l)?l:[l]).forEach(x => x && x.text && said.push(x.text)); return orig(l, cb); };
      Scene.play = n => { said.push('СЦЕНА:' + n); return Promise.resolve(); };
      try { np.dialogue(); } catch(e) { said.push('ОШИБКА:' + e.message); }
      Dialogue.start = orig; Scene.play = origScene;
      return said[0] || '(молчит)';
    }, id);
    console.log('  ' + id.padEnd(16) + line.slice(0, 74));
    if (/ещё не знакомы/.test(line))
      bad.push(`${id}: Женевьева не узнаёт Наю после университета`);
  }

  await b.close();
  errs.forEach(e => { console.log(e); bad.push(e); });
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: каждая точка меню даёт связное состояние сюжета');
})();
