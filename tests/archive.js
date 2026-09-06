/* Четвёртый день, цокольный архив.

   Баг, который ловит этот прогон: цель говорила «найти в цокольном архиве
   пропавшую папку», а коробки отвечали дежурной строкой про программы и
   афиши. Причина была двойная — флаг «была в цоколе» не сбрасывался с
   третьего дня, и сами коробки открывались только если Наю выгнала
   охрана. В корпус на четвёртый день можно вернуться и знакомой дорогой
   через старое крыло, никого не встретив. */
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args:['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage({ viewport:{ width:420, height:860 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(800);

  const bad = [];
  const use = async name => {
    const r = await p.evaluate(async n => {
      const o = World.objectsOf ? null : null;
      const room = Rooms[gameState.currentRoom];
      const it = (room.interactables || []).filter(i => !i.when || i.when()).find(i => i.name === n);
      if (!it) return 'НЕТ ' + n;
      await it.action();
      return 'ok';
    }, name);
    await p.waitForTimeout(600);
    // доиграть диалоги, если сцена их открыла
    for (let i = 0; i < 60; i++) {
      const st = await p.evaluate(() => ({ d:Dialogue.active, s:Scene.active, ch:Dialogue.awaitingChoice }));
      if (!st.d && !st.s) break;
      if (st.ch) await p.evaluate(() => document.querySelector('#choiceBox .choiceBtn').click());
      else await p.evaluate(() => Dialogue.advance ? Dialogue.advance() : Dialogue.next && Dialogue.next());
      await p.waitForTimeout(140);
    }
    return r;
  };

  /* Ная прошла библиотеку четвёртого дня (папок нет), но охрана её не
     ловила: в корпус она вернулась знакомой дорогой. */
  await p.evaluate(async () => {
    const pt = DevTools.storyPoints.find(s => s.id === 'uni_day4_morel');
    await DevTools.applyPoint(pt);
  });
  await p.waitForTimeout(800);
  let st = await p.evaluate(() => ({
    day:C('uniDay'), banned:F('universityBanned'), lib:F('libMissing'),
    sawBasement:F('sawBasement'), goal:(Quests.goal()||{}).t }));
  console.log('старт: день=%s выгнали=%s папок нет=%s цоколь сегодня=%s', st.day, st.banned, st.lib, st.sawBasement);
  console.log('цель: %s', st.goal);
  if (st.banned) bad.push('сценарий не тот: охрана уже выгнала');
  if (st.sawBasement) bad.push('флаг «была в цоколе» не сбросился с третьего дня');

  // знакомой дорогой: второй этаж -> старое крыло -> служебная лестница -> цоколь
  await p.evaluate(async () => { await DevTools.teleport('uniCorr2'); });
  await p.waitForTimeout(600);
  for (const step of ['toOldWing','toService','down','toArchive']) {
    const r = await use(step);
    if (r !== 'ok') { bad.push('шаг ' + step + ': ' + r); break; }
    const room = await p.evaluate(() => gameState.currentRoom);
    console.log('%s -> %s', step, room);
  }
  st = await p.evaluate(() => ({ room:gameState.currentRoom, goal:(Quests.goal()||{}).t, sub:Quests.sub(Quests.goal()||{}) }));
  console.log('в архиве: комната=%s', st.room);
  console.log('цель: %s / %s', st.goal, st.sub);
  if (st.room !== 'uniArchive') bad.push('до архива не дошли: ' + st.room);
  if (!/пропавшую папку/.test(st.goal || '')) bad.push('цель не про папку: ' + st.goal);

  const r = await use('archBoxes');
  if (r !== 'ok') bad.push('коробки: ' + r);
  st = await p.evaluate(() => ({ found:F('archiveFolderFound'), goal:(Quests.goal()||{}).t }));
  console.log('после коробок: папка найдена=%s', st.found);
  console.log('цель: %s', st.goal);
  if (!st.found) bad.push('коробки не отдали папку — цель и предмет разошлись');

  await b.close();
  errs.forEach(e => { console.log(e); bad.push(e); });
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: цель про папку и коробки в архиве говорят об одном');
})();
