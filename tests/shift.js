/* Смена в кафе: игра должна проходиться и заканчиваться сама.

   Проверяем весь цикл официантки: гость садится → Ная принимает заказ →
   называет блюдо Крису → Крис готовит → Ная забирает с выдачи и относит
   тому, кто заказывал. Плюс главное требование: смена завершается, даже
   если игрок не выдал ни одного заказа.

   Играем своим циклом, а не общим pump: смена запускается напрямую, вне
   сцены, и общий pump после её конца остался бы ждать выхода из
   cutscene, которого некому вернуть. */
const H = require('./harness.js');

/* Один ход «игрока»: смотрит на зал и ведёт Наю ногами к ближайшему делу. */
const TURN = `(() => {
  const S = Shift;
  if (!S.resolve) return 'done';
  const go = (x, y) => { S.naya.tx = x; S.naya.ty = y; };
  if (S.menuOpen) {
    const g = S.guests.find(x => x.state === 'ordered');
    if (!g) { S.menuOpen = false; return 'close'; }
    /* Сетка меню — две колонки на три ряда, и считать ячейку надо ровно
       так же, как это делает pickDish. Старая раскладка 3×2 промахивалась
       мимо нужного блюда и всегда выбирала первое из доступных. */
    const menu = S.availableMenu();
    const i = menu.findIndex(m => m.id === g.dish);
    if (i < 0) { S.menuOpen = false; return 'nodish'; }
    const b = S.MENU_BOX;
    S.pickDish(b.x + 6 + (i % 2) * 130 + 60, b.y + 28 + ((i / 2) | 0) * 62 + 30);
    return 'cook';
  }
  if (S.carry) {
    const g = S.guests.find(x => x.state === 'ordered' && x.dish === S.carry);
    if (g) { const t = S.TABLES[g.table]; go(t.x, t.y + 26); return 'serve'; }
    S.carry = null; return 'drop';
  }
  if (S.pass.length) { go(160, 118); return 'take'; }
  const w = S.guests.find(x => x.state === 'waiting');
  if (w) { const t = S.TABLES[w.table]; go(t.x, t.y + 26); return 'order'; }
  if (!S.cooking && S.guests.some(x => x.state === 'ordered')) { go(70, 118); return 'counter'; }
  return 'wait';
})()`;

(async () => {
  const out = await H.run('SHIFT', async page => {
    await H.newGame(page);
    await page.evaluate(() => {
      Dialogue.active = false; Scene.active = false; Game.mode = 'explore';
      document.getElementById('dialogueBox').classList.remove('active');
      document.getElementById('fade').classList.remove('show');
      gameState.flags.mainStoryStarted = true; gameState.flags.metSue = true;
      gameState.currentRoom = 'cafe';
    });
    const start = ms => page.evaluate(m => {
      Shift.SHIFT_MS = m; window.__res = null;
      Shift.run().then(() => { window.__res = {
        served: Shift.served, missed: Shift.missed, wrong: Shift.wrong,
        done: gameState.flags.cafeShiftFinished,
        shown: document.getElementById('shiftScreen').classList.contains('show'),
      }; });
    }, ms);
    const wait = async (play) => {
      for (let i = 0; i < 400; i++) {
        const r = await page.evaluate(() => window.__res);
        if (r) return r;
        if (play) await page.evaluate(TURN);
        await page.waitForTimeout(play ? 500 : 900);
      }
      throw new Error('смена не закончилась');
    };

    await start(30000);                       // 1. играем
    const played = await wait(true);
    await page.evaluate(() => { Game.mode = 'explore'; gameState.flags.cafeShiftFinished = false; });

    await start(8000);                        // 2. не делаем ничего
    const idle = await wait(false);
    await page.evaluate(() => { Game.mode = 'explore'; });
    return { played, idle };
  });

  const bad = [];
  const p = out.played, i = out.idle;
  console.log('игра:        выдано=%s пропущено=%s ошибок=%s экран закрыт=%s', p.served, p.missed, p.wrong, !p.shown);
  console.log('бездействие: выдано=%s смена засчитана=%s экран закрыт=%s', i.served, i.done, !i.shown);
  if (!p.done)      bad.push('после игры не выставлен cafeShiftFinished');
  if (p.shown)      bad.push('экран смены остался открыт после игры');
  if (p.served < 1) bad.push('за смену не выдано ни одного заказа: цикл не работает');
  if (p.wrong > 0)  bad.push('блюдо ушло не тому: перепутана адресация заказов');
  if (!i.done)      bad.push('смена без единого действия не завершилась');
  if (i.shown)      bad.push('экран смены остался открыт после бездействия');
  H.errors.forEach(e => { bad.push(e); });
  if (bad.length) { bad.forEach(b => console.log('  ' + b)); console.log('\nПРОВАЛ'); process.exit(1); }
  console.log('\nOK: смена проходится и всегда завершается');
})();
