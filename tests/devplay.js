/* ОТ ТОЧКИ МЕНЮ — ДО КОНЦОВКИ.

   Проверка связности флагов (tests/devpoints.js) говорит только то, что
   состояние непротиворечиво. Здесь проверяется главное: что из него
   действительно можно доиграть. Старт — кнопка меню разработчика, а не
   расставленные вручную флаги, дальше обычные шаги игрока до карточки. */
const H = require('./harness.js');

const jump = async (page, id) => {
  const ok = await page.evaluate(async id => {
    const point = DevTools.storyPoints.find(x => x.id === id);
    if (!point) return 'НЕТ ТОЧКИ ' + id;
    localStorage.clear();
    await DevTools.applyPoint(point);
    return 'ok';
  }, id);
  if (ok !== 'ok') throw new Error(ok);
  await page.waitForTimeout(600);
  await H.pump(page, [], 'jump:' + id);
};

/* H.snap цели не отдаёт, а в логе она нужнее комнаты: по ней видно,
   осмысленно ли состояние, в которое прыгнула кнопка меню. */
const goalOf = page => page.evaluate(() => { const g = Quests.goal(); return g ? g.t : '(нет)'; });

const card = async page => {
  await page.waitForSelector('#endingScreen.show', { timeout:20000 });
  return page.evaluate(() => ({
    roman: document.getElementById('endingRoman').textContent,
    name:  document.getElementById('endingName').textContent,
  }));
};

(async () => {
  const bad = [];

  /* Ветка «злая Ная»: точка «Сью оставлена мёртвой» -> концовка II. */
  const evil = await H.run('DEVPLAY-evil', async page => {
    await H.newGame(page);
    await jump(page, 'sue_left_dead');
    let s = await H.snap(page);
    console.log('старт: комната=%s цель=%s', s.room, await goalOf(page));
    await H.step(page,'obj','door',[],'EVIL');
    await H.step(page,'obj','stone',[],'EVIL');
    await H.step(page,'obj','onward',[],'EVIL');
    await H.step(page,'obj','inside',[],'EVIL');
    await H.step(page,'npc','Старшая',[],'EVIL');
    await H.step(page,'obj','toTrial',[],'EVIL');
    await H.step(page,'obj','altar',[1],'EVIL');
    await H.step(page,'obj','exit',[],'EVIL');
    await H.step(page,'npc','Старшая',[],'EVIL');
    await H.step(page,'npc','Житель',[],'EVIL');
    await H.step(page,'obj','greatPortal',[],'EVIL');
    return card(page);
  });
  console.log('злая ветка ->', evil.roman, evil.name);
  if (!/II$/.test(evil.roman)) bad.push('из точки sue_left_dead пришли не в концовку II: ' + evil.roman);

  /* Ветка «одиночка»: точка «Одна в городе» -> погоня -> концовка I.
     Точка стартует на Мейпл-стрит сразу после отказа Сью. */
  const loner = await H.run('DEVPLAY-loner', async page => {
    await H.newGame(page);
    await jump(page, 'loner_town');
    const s0 = await H.snap(page);
    console.log('старт: комната=%s цель=%s', s0.room, await goalOf(page));
    await H.step(page,'obj','toRightHouse',[],'LONER');
    await H.step(page,'obj','toLiving',[],'LONER');
    await H.step(page,'npc','Женевьева',[],'LONER');    // lonerGenevieve
    await H.step(page,'obj','toHallway',[],'LONER');
    await H.step(page,'obj','exit',[],'LONER');
    await H.step(page,'obj','toLeftHouse',[],'LONER');  // lonerDoor
    await H.step(page,'obj','toAlley',[],'LONER');
    await H.step(page,'obj','window',[],'LONER');       // взлом
    await H.stealth(page, 'LONER', []);                // кража у Мадлен
    /* madAfterTheft сама выводит Наю в старый квартал, отдельного
       выхода из переулка больше нет. */
    await H.step(page,'obj','toStreet',[],'LONER');
    await H.step(page,'obj','toRightHouse',[],'LONER');
    await H.step(page,'obj','toLiving',[],'LONER');
    await H.step(page,'obj','toCommune',[],'LONER');    // обнаружили -> погоня
    const ran = await H.chase(page, 'LONER');
    console.log('погоня пройдена, ушла =', ran.escaped);
    await H.pump(page, [], 'LONER:caught');
    return card(page);
  });
  console.log('ветка одиночки ->', loner.roman, loner.name);
  if (!/ I$/.test(loner.roman)) bad.push('из точки loner_town пришли не в концовку I: ' + loner.roman);

  H.errors.forEach(e => bad.push(e));
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: из точки меню игра доигрывается до карточки концовки');
})();
