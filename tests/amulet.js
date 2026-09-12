/* Второе имя без убийства.

   Женевьева рассказывает про Клару — ведьму, умершую восемь лет назад,
   чьё имя так и не нашли. После этого в старом квартале можно вскрыть её
   заколоченный дом и забрать амулет оттуда. Тогда Роза остаётся жива, а
   коммуна реагирует на кражу из пустого дома, а не на вторую смерть.

   Прогон проверяет обе стороны развилки: что маршрут проходится, что
   Роза жива и на месте, и что сцены коммуны говорят о Кларе, а не о ней. */
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
  const drain = async () => {
    for (let i = 0; i < 90; i++) {
      const st = await p.evaluate(() => ({ d:Dialogue.active, s:Scene.active, ch:Dialogue.awaitingChoice }));
      if (!st.d && !st.s) return;
      if (st.ch) await p.evaluate(() => document.querySelector('#choiceBox .choiceBtn').click());
      else await p.evaluate(() => Dialogue.advance());
      await p.waitForTimeout(130);
    }
  };
  const use = async name => {
    const r = await p.evaluate(async n => {
      const room = Rooms[gameState.currentRoom];
      const it = (room.interactables || []).filter(i => !i.when || i.when()).find(i => i.name === n);
      if (!it) return 'НЕТ ' + n;
      await it.action();
      return 'ok';
    }, name);
    await p.waitForTimeout(400);
    await drain();
    return r;
  };
  const talk = async name => {
    const r = await p.evaluate(async n => {
      const room = Rooms[gameState.currentRoom];
      const np = (room.npcs || []).filter(x => !x.when || x.when()).find(x => x.name === n);
      if (!np) return 'НЕТ ' + n;
      await np.dialogue();
      return 'ok';
    }, name);
    await p.waitForTimeout(400);
    await drain();
    return r;
  };

  /* Состояние: первый амулет взят, второго нет. */
  await p.evaluate(async () => {
    DevTools.baseUni(1);
    Object.assign(gameState.flags, {
      prologueComplete:true, backstoryDone:true, mainStoryStarted:true, metSue:true,
      metGenevieve:true, foundGenevieve:true, learnedWitches:true, toldSueWitch:true,
      communeIntro:true, persuasionDone:true, sueAgreed:true, invitationPlan:true,
      firstAmulet:true, firstWitchDead:true, communePanic:true,
      secondAmulet:false, claraHint:false, hiddenAmulet:false,
    });
    DevTools.ensureRunning();
    await DevTools.teleport('genLiving');    // Женевьева теперь в гостиной
  });
  await p.waitForTimeout(700);

  console.log('Женевьева:', await talk('Женевьева'));
  let st = await p.evaluate(() => ({ hint:F('claraHint'), j:gameState.journal.includes('claraName'),
                                     goal:(Quests.goal()||{}).t, sub:Quests.sub(Quests.goal()||{}) }));
  console.log('подсказка про Клару=%s запись в журнале=%s', st.hint, st.j);
  console.log('цель: %s / %s', st.goal, st.sub);
  if (!st.hint) bad.push('Женевьева не рассказала про Клару');
  if (!st.j)    bad.push('в журнале нет записи про Клару');
  if (!/Клар/.test(st.sub || '')) bad.push('подсказка цели не называет дом Клары: ' + st.sub);

  await p.evaluate(async () => { await DevTools.teleport('oldTown'); });
  await p.waitForTimeout(700);
  console.log('заколоченный дом:', await use('boarded'));
  st = await p.evaluate(() => ({ second:F('secondAmulet'), hidden:F('hiddenAmulet'),
                                 doubts:F('sueDoubts'), j:gameState.journal.includes('claraFound') }));
  console.log('второе имя=%s найдено в доме=%s запись=%s', st.second, st.hidden, st.j);
  if (!st.second) bad.push('амулет не получен');
  if (!st.hidden) bad.push('не отмечено, что имя найдено, а не отобрано');
  if (!st.j)      bad.push('находка не попала в журнал');

  /* Роза жива: она на месте и в своём доме, и в коммуне. */
  await p.evaluate(async () => { await DevTools.teleport('witch2House'); });
  await p.waitForTimeout(600);
  const rosaHome = await p.evaluate(() =>
    (Rooms.witch2House.npcs || []).some(n => n.name === 'Роза' && (!n.when || n.when())));
  console.log('Роза дома: %s', rosaHome);
  if (!rosaHome) bad.push('Роза исчезла из своего дома, хотя жива');
  console.log('разговор с Розой:', await talk('Роза'));

  await p.evaluate(async () => { await DevTools.teleport('communeYard'); });
  await p.waitForTimeout(600);
  const rosaCommune = await p.evaluate(() =>
    (Rooms.communeYard.npcs || []).some(n => n.name === 'Роза' && (!n.when || n.when())));
  console.log('Роза в коммуне: %s', rosaCommune);
  if (!rosaCommune) bad.push('Роза исчезла из коммуны, хотя жива');

  /* Собрание должно говорить о доме Клары, а не о смерти Розы. */
  await p.evaluate(async () => { await DevTools.teleport('communeHall'); });
  await p.waitForTimeout(500);
  const lines = [];
  p.on('console', () => {});
  await p.evaluate(() => { window.__lines = []; const orig = Dialogue.start.bind(Dialogue);
    Dialogue.start = (l, cb) => { (Array.isArray(l) ? l : [l]).forEach(x => x && x.text && window.__lines.push(x.text)); return orig(l, cb); }; });
  await p.evaluate(() => Scene.play('communeWardScene'));
  await p.waitForTimeout(600); await drain();
  const said = await p.evaluate(() => window.__lines.join(' | '));
  console.log('собрание:', said.slice(0, 160));
  if (/Роза умерла/.test(said)) bad.push('собрание объявляет Розу мёртвой, хотя она жива');
  if (!/Клар/.test(said))       bad.push('собрание не упоминает дом Клары');
  const warded = await p.evaluate(() => ({ w:F('communeWarded'), t:F('thirdHouseOpen') }));
  if (!warded.w || !warded.t) bad.push('собрание не открыло третий дом');

  await b.close();
  errs.forEach(e => { console.log(e); bad.push(e); });
  if (bad.length) { console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('\nOK: второе имя можно найти, и тогда Роза остаётся жива');
})();
