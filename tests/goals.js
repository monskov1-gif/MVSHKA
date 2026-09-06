/* Цели главы должны вести игрока по шагам.

   Третий день ломался не картой, а навигацией: маршрут в цоколь работал,
   но цель говорила только «найти настоящий архив», и игроку нечем было
   догадаться, что старое крыло на втором этаже. Тест проходит по каждому
   дню, выставляя флаги в том же порядке, в каком их получает игрок, и
   требует, чтобы цель менялась на каждом шаге и называла место. */
const H = require('./harness.js');

const CHAIN = {
  1: ['uniTeacherList','sawRehearsal','metGenevieveUni','symbolPhoto','libAsked'],
  2: ['libPeriods','propsSymbol','propsMorel','morelKnowsName'],
  3: ['basementFound','sawFloor2','sawOldWing','sawBasement','archiveMedeaFound','archiveMorelFound','roofPromise'],
  4: ['libMissing','morelPhotoSeen','universityBanned','backWindowUsed','sawBasement','archiveFolderFound','premiereDone','morelTruth'],
};
/* Шаги, на которых игрок должен физически перейти в другое место, —
   у них обязано быть уточнение «где». */
const NEEDS_PLACE = {
  1: ['uniTeacherList','metGenevieveUni','symbolPhoto','libAsked'],
  2: ['start','libPeriods','propsSymbol','morelKnowsName'],
  3: ['start','shift','basementFound','sawFloor2','sawOldWing','sawBasement','archiveMorelFound','roofPromise'],
  4: ['libMissing','universityBanned','archiveFolderFound','premiereDone'],
};

(async () => {
  const out = await H.run('GOALS', async page => {
    await H.newGame(page);
    return page.evaluate(([CHAIN, NEEDS]) => {
      Dialogue.active = false; Scene.active = false; Game.mode = 'explore';
      ['mainStoryStarted','metSue','cafeSceneComplete','uniArrived'].forEach(f => gameState.flags[f] = true);
      const rows = [];
      const peek = (day, step) => {
        const g = Quests.goal() || {};
        rows.push({ day, step, t:g.t || '', s:Quests.sub(g) || '' });
      };
      for (const day of [1, 2, 3, 4]) {
        gameState.counters.uniDay = day;
        if (day <= 3) {
          gameState.flags.cafeShiftFinished = false; peek(day, 'start');
          gameState.flags.cafeShiftFinished = true;  peek(day, 'shift');
        } else peek(day, 'start');
        CHAIN[day].forEach(f => { gameState.flags[f] = true; peek(day, f); });
        CHAIN[day].forEach(f => { gameState.flags[f] = false; });
        if (day === 3) gameState.flags.sawBasement = false;
      }
      return rows;
    }, [CHAIN, NEEDS_PLACE]);
  });

  const bad = [];
  out.forEach(r => console.log(`д${r.day} ${r.step.padEnd(20)} | ${r.t}${r.s ? '  → ' + r.s : ''}`));

  // 1. на каждом шаге цель обязана меняться — иначе шаг игроку не виден.
  //    Исключение: первый день начинается уже после смены (она входит в
  //    сцену знакомства в кафе), поэтому гейта на неё там нет.
  for (let i = 1; i < out.length; i++) {
    if (out[i].day !== out[i - 1].day) continue;
    if (out[i].day === 1 && out[i].step === 'shift') continue;
    if (out[i].t === out[i - 1].t)
      bad.push(`д${out[i].day}: цель не изменилась после «${out[i].step}» — ${out[i].t}`);
  }
  // 2. шаги с переходом в другое место обязаны говорить, куда идти
  out.forEach(r => {
    if ((NEEDS_PLACE[r.day] || []).includes(r.step) && !r.s)
      bad.push(`д${r.day}: у шага «${r.step}» нет уточнения места — ${r.t}`);
  });
  // 3. первые три дня начинаются со смены
  [2, 3].forEach(d => {
    const r = out.find(x => x.day === d && x.step === 'start');
    if (!/смену в кафе/i.test(r.t)) bad.push(`д${d}: день не начинается со смены — ${r.t}`);
  });
  // 4. четвёртый день смены не требует
  const d4 = out.find(x => x.day === 4 && x.step === 'start');
  if (/смену в кафе/i.test(d4.t)) bad.push('д4: смена не должна требоваться, за Наю работает Крис');

  if (bad.length) { console.log(''); bad.forEach(b => console.log('  ' + b)); console.log('\nПРОВАЛ'); process.exit(1); }
  console.log('\nOK: цели ведут по шагам и называют места');
})();
