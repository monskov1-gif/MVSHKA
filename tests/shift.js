/* Смена в кафе: игра должна проходиться и заканчиваться сама.

   Проверяем весь цикл официантки: гость садится → Ная принимает заказ →
   называет блюдо Крису → Крис готовит → Ная забирает с выдачи и относит
   тому, кто заказывал. Плюс главное требование: смена завершается, даже
   если игрок не выдал ни одного заказа. */
const H = require('./harness.js');

(async () => {
  const out = await H.run('SHIFT', async page => {
    await H.newGame(page);
    // сразу в смену, минуя пролог
    await page.evaluate(() => {
      Dialogue.active = false; Scene.active = false; Game.mode = 'explore';
      document.getElementById('dialogueBox').classList.remove('active');
      document.getElementById('fade').classList.remove('show');
      gameState.flags.mainStoryStarted = true; gameState.flags.metSue = true;
      gameState.currentRoom = 'cafe';
    });
    const runShift = () => page.evaluate(() => { Shift.SHIFT_MS = 26000; return Shift.run().then(() => ({
      served: Shift.served, missed: Shift.missed, wrong: Shift.wrong,
      done: gameState.flags.cafeShiftFinished,
      shown: document.getElementById('shiftScreen').classList.contains('show'),
    })); });

    // 1. проход игрока: харнесс водит Наю ногами
    const p1 = runShift();
    await H.pump(page, [], 'SHIFT:play');
    const played = await p1;

    // 2. полное бездействие: смена всё равно должна закончиться
    await page.evaluate(() => { gameState.flags.cafeShiftFinished = false; });
    const idle = await page.evaluate(() => { Shift.SHIFT_MS = 9000; return Shift.run().then(() => ({
      served: Shift.served, done: gameState.flags.cafeShiftFinished,
      shown: document.getElementById('shiftScreen').classList.contains('show'),
      mode: Game.mode,
    })); });
    return { played, idle };
  });

  const bad = [];
  const p = out.played, i = out.idle;
  console.log('игра:      выдано=%s пропущено=%s ошибок=%s экран закрыт=%s', p.served, p.missed, p.wrong, !p.shown);
  console.log('бездействие: выдано=%s смена засчитана=%s экран закрыт=%s', i.served, i.done, !i.shown);
  if (!p.done)  bad.push('после игры не выставлен cafeShiftFinished');
  if (p.shown)  bad.push('экран смены остался открыт после игры');
  if (p.served < 1) bad.push('за смену не выдано ни одного заказа: цикл не работает');
  if (p.wrong > 0)  bad.push('харнесс отнёс блюдо не тому: перепутана адресация');
  if (!i.done)  bad.push('смена без единого действия не завершилась');
  if (i.shown)  bad.push('экран смены остался открыт после бездействия');
  if (bad.length) { bad.forEach(b => console.log('  ' + b)); console.log('\nПРОВАЛ'); process.exit(1); }
  console.log('\nOK: смена проходится и всегда завершается');
})();
