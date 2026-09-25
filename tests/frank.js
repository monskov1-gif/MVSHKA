/* ЛИНИЯ ФРЕНКА — «ТО, ЧЕГО ОН НЕ СКАЗАЛ».

   Скрытая дуга, которая открывается одной репликой в первой главе и
   идёт между сменами Наи в кафе. Проверяется то, из-за чего такие линии
   обычно ломаются:

     A — линия открывается нужной репликой, звонок приходит после второй
         смены, Френк приходит после третьей;
     B — при любой другой реплике линии нет вовсе: ни звонка, ни встречи;
     C — ветка прощения ставит своё состояние;
     D — ветка отказа ставит своё, и игра продолжается;
     E — сброшенный звонок ничего не ломает: игра не виснет, Френк не
         появляется мгновенно, звонки не повторяются бесконечно;
     F — четыре основные концовки не задеты, и прощение не выбирает
         концовку за игрока.

   Плюс: старые сохранения без новых флагов грузятся, помощь не покупает
   прощение, отказ не штрафует человечность.

   Запуск: node tests/frank.js                                         */
const H = require('./harness.js');

const fails = [], notes = [];
const ok = (c, m) => { if (!c) fails.push(m); else notes.push('  ✓ ' + m); };

/* Довести игру до состояния «идёт день N главы, Ная в кафе». Ничего не
   подменяем: те же флаги, тот же changeRoom, что и в игре. */
const setDay = (page, day, flags) => page.evaluate(async a => {
  Scene.abort();
  if (Dialogue.active) Dialogue.cancel();
  Game.mode = 'explore';
  Object.assign(gameState.flags, {
    prologueComplete:true, backstoryDone:true, prologBackstoryStarted:true,
    mainStoryStarted:true, cafeSceneComplete:true, uniArrived:true,
    /* Смена уже отработала: иначе комната запустит её сама при входе,
       и проверка линии споткнётся о чужую сцену. */
    cafeShiftStarted:true, cafeShiftFinished:true,
  }, a.flags || {});
  gameState.counters.uniDay = a.day;
  await changeRoom('cafe', 150, 240);
  Game.mode = 'explore';
  document.getElementById('fade').classList.remove('show');
}, { day, flags });

const snap = page => page.evaluate(() => FrankArc.getDebugState());

/* Проиграть сцену до конца, выбирая заданные варианты. */
async function run(page, picks, ms, tag) {
  const t0 = Date.now(); let ci = 0;
  while (Date.now() - t0 < (ms || 20000)) {
    const st = await page.evaluate(() => ({
      dlg: Dialogue.active, choice: Dialogue.awaitingChoice, scene: Scene.active,
      n: document.querySelectorAll('#choiceOptions .choiceOpt').length,
      texts: [...document.querySelectorAll('#choiceOptions .choiceOpt')].map(b => b.textContent.slice(0,40)),
      mode: Game.mode,
    }));
    if (st.choice && st.n) {
      const want = picks[ci] === undefined ? 0 : picks[ci];
      if (process.env.VERBOSE) console.log('  [' + tag + '] выбор#' + ci + ' -> ' + want + ': ' + st.texts[want]);
      ci++;
      await page.evaluate(k => document.querySelectorAll('#choiceOptions .choiceOpt')[k].click(),
                          Math.min(want, st.n - 1));
      await page.waitForTimeout(240); continue;
    }
    if (st.dlg) { await page.evaluate(() => Dialogue.advance()); await page.waitForTimeout(30); continue; }
    if (st.scene || st.mode === 'cutscene' || st.mode === 'transition') { await page.waitForTimeout(80); continue; }
    return { consumed: ci };
  }
  throw new Error(tag + ': сцена не доиграла за ' + ms + ' мс');
}

/* Дождаться, пока линия сама запустит сцену после смены. */
async function waitScene(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(() => Scene.active || Dialogue.active)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function main() {
  await H.run('FRANK', async page => {
    await H.newGame(page);

    /* ============ A: линия открывается нужной репликой ============ */
    /* Реплика стоит в сцене первой главы: проверяем, что флаг ставит
       именно она, а не что-нибудь ещё. */
    const srcHasFlag = await page.evaluate(() => {
      const opt = Scripts.pastFrank
        .map(st => st && st.dlg && st.dlg.find(l => l.choice))
        .filter(Boolean)[0];
      const o = opt.choice.options.find(x => /не вмешался/.test(x.text));
      return !!(o && o.set && o.set.frankArcUnlocked);
    });
    ok(srcHasFlag, 'A: реплика «почему ты ни разу не вмешался» открывает линию');

    const otherOpts = await page.evaluate(() => {
      const opt = Scripts.pastFrank
        .map(st => st && st.dlg && st.dlg.find(l => l.choice))
        .filter(Boolean)[0];
      return opt.choice.options.filter(x => !/не вмешался/.test(x.text))
        .map(x => !!(x.set && x.set.frankArcUnlocked));
    });
    ok(otherOpts.length >= 2 && otherOpts.every(v => !v),
       'B: остальные реплики первой главы линию не открывают (' + otherOpts.length + ' шт.)');

    /* ============ B: без флага после смен ничего не происходит ====== */
    await setDay(page, 2, { frankArcUnlocked:false });
    await page.evaluate(() => FrankArc.afterShift());
    const quiet2 = await waitScene(page, 6500);
    ok(!quiet2, 'B: без линии после второй смены звонка нет');
    await setDay(page, 3, { frankArcUnlocked:false });
    await page.evaluate(() => FrankArc.afterShift());
    const quiet3 = await waitScene(page, 5500);
    ok(!quiet3, 'B: без линии после третьей смены Френк не приходит');

    /* ============ A: звонок после второй смены ============ */
    await setDay(page, 2, { frankArcUnlocked:true });
    await page.evaluate(() => FrankArc.afterShift());
    const rang = await waitScene(page, 9000);
    ok(rang, 'A: после второй смены телефон звонит');
    await run(page, [0, 0], 25000, 'звонок');          // ответить → «приходи»
    let st = await snap(page);
    ok(st.called && st.visitAccepted && !st.visitRejected,
       'A: звонок принят, встреча назначена (' + JSON.stringify([st.called, st.visitAccepted]) + ')');

    /* Звонок не повторяется: линия не спамит. */
    await setDay(page, 2, { frankArcUnlocked:true });
    await page.evaluate(() => FrankArc.afterShift());
    const again = await waitScene(page, 6500);
    ok(!again, 'E: второй раз тот же звонок не приходит');

    /* ============ A: встреча после третьей смены ============ */
    await setDay(page, 3, { frankArcUnlocked:true });
    await page.evaluate(() => FrankArc.afterShift());
    const came = await waitScene(page, 8000);
    ok(came, 'A: после третьей смены Френк приходит в кафе');
    /* Он должен физически войти в дверь, а не возникнуть у столика:
       ловим его первую позицию, как только он появился в кадре. */
    let enter = null;
    for (let i = 0; i < 160 && !enter; i++) {
      enter = await page.evaluate(() => {
        const f = (Game.cast || []).find(c => c.name === 'Фрэнк');
        return f ? { x:Math.round(f.x), y:Math.round(f.y) } : null;
      });
      if (!enter) { await page.evaluate(() => { if (Dialogue.active) Dialogue.advance(); });
                    await page.waitForTimeout(60); }
    }
    ok(enter && enter.y > 240, 'A: Френк входит от двери, а не появляется у столика (' +
       JSON.stringify(enter) + ')');

    /* ============ C: прощение + помощь не покупает прощение ======== */
    const hum0 = await page.evaluate(() => Math.round(S('humanity')));
    await run(page, [0, 0], 40000, 'встреча-прощение');   // взять конверт → простить
    st = await snap(page);
    const hum1 = await page.evaluate(() => Math.round(S('humanity')));
    ok(st.forgiven && !st.rejected && st.resolution === 'FORGIVEN',
       'C: ветка прощения ставит FORGIVEN');
    ok(st.offeredHelp && st.helpAccepted, 'C: помощь предложена и принята');
    ok(st.met, 'C: встреча отмечена пройденной');
    ok(hum1 > hum0, 'C: человечность выросла (' + hum0 + ' → ' + hum1 + ')');
    const after = await page.evaluate(() => ({ mode:Game.mode, room:gameState.currentRoom,
                                               cast:(Game.cast||[]).length }));
    ok(after.mode === 'explore' && after.cast === 0,
       'C: управление вернулось, Френк ушёл (' + JSON.stringify(after) + ')');

    /* ============ D: отказ — полноценная ветка без штрафа =========== */
    await page.evaluate(() => { FrankArc.devReset(); FrankArc.devUnlock();
                                setFlag('frankCalled'); setFlag('frankVisitAccepted'); });
    await setDay(page, 3, { frankArcUnlocked:true, frankCalled:true, frankVisitAccepted:true });
    const humA = await page.evaluate(() => Math.round(S('humanity')));
    await page.evaluate(() => Scene.play('frankCafeVisit'));
    await waitScene(page, 6000);
    await run(page, [1, 1], 40000, 'встреча-отказ');      // не брать конверт → не простить
    st = await snap(page);
    const humB = await page.evaluate(() => Math.round(S('humanity')));
    ok(st.rejected && !st.forgiven && st.resolution === 'REJECTED',
       'D: ветка отказа ставит REJECTED');
    ok(st.helpRejected && !st.helpAccepted, 'D: от помощи можно отказаться');
    ok(humB >= humA, 'D: отказ не штрафует человечность (' + humA + ' → ' + humB + ')');
    const alive = await page.evaluate(() => ({ mode:Game.mode, ending:Game.endingShown }));
    ok(alive.mode === 'explore' && !alive.ending, 'D: игра продолжается после отказа');

    /* ============ E: сброшенный звонок ============ */
    await page.evaluate(() => FrankArc.devReset());
    await setDay(page, 2, { frankArcUnlocked:true });
    await page.evaluate(() => FrankArc.afterShift());
    await waitScene(page, 9000);
    await run(page, [1, 1], 25000, 'звонок-сброс');       // сбросить → не отвечать
    st = await snap(page);
    ok(st.called && st.visitRejected && !st.visitAccepted,
       'E: сброс звонка записан как отказ от встречи');
    const hung = await page.evaluate(() => ({ mode:Game.mode, scene:Scene.active, dlg:Dialogue.active }));
    ok(hung.mode === 'explore' && !hung.scene && !hung.dlg, 'E: игра не зависла');
    await setDay(page, 3, { frankArcUnlocked:true });
    await page.evaluate(() => FrankArc.afterShift());
    const ghost = await waitScene(page, 6500);
    ok(!ghost, 'E: после отказа Френк в кафе не приходит');

    /* ============ старые сохранения ============ */
    const legacy = await page.evaluate(() => {
      const st = JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY) || '{}');
      FrankArc.FLAGS.forEach(k => { delete gameState.flags[k]; });
      const d = FrankArc.getDebugState();
      return { unlocked:d.unlocked, resolution:d.resolution, quiet:FrankArc.quiet() !== undefined };
    });
    ok(!legacy.unlocked && legacy.resolution === 'NONE' && legacy.quiet,
       'старое сохранение без новых полей: линия закрыта, ничего не падает');

    /* ============ F: линия не выбирает концовку ============ */
    const noAuto = await page.evaluate(() => {
      const src = Scripts.reflectionScene.concat(Scripts.earthEnding, Scripts.hellFinalScene);
      const bad = [];
      const scan = o => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) return o.forEach(scan);
        for (const k in o) {
          const v = o[k];
          if (typeof v === 'function') {
            const s = v.toString();
            if (/nayaForgaveFrank|frankResolution|FrankArc\.resolution/.test(s) &&
                /ending|chosenEarthPath|chosenWitchPath|jump/.test(s)) bad.push(k + ': ' + s.slice(0,70));
          } else scan(v);
        }
      };
      scan(src);
      return bad;
    });
    ok(noAuto.length === 0, 'F: прощение нигде не выбирает концовку за игрока' +
       (noAuto.length ? ' — ' + noAuto.join(' | ') : ''));

    const endingsIntact = await page.evaluate(() =>
      ['I','II','III','IV'].every(id => !!Endings.DEFS[id]) &&
      typeof Scripts.earthEnding !== 'undefined' &&
      typeof Scripts.hellFinalScene !== 'undefined' &&
      typeof Scripts.endingLoner !== 'undefined');
    ok(endingsIntact, 'F: четыре основные концовки на месте');

    /* DEV-кнопки зовут реальные функции линии, а не свои диалоги. */
    const devOk = await page.evaluate(() => {
      const ids = ['devFrUnlock','devFrCall','devFrVisit','devFrForgive','devFrReject',
                   'devFrHelpYes','devFrHelpNo','devFrReset'];
      const missing = ids.filter(i => !document.getElementById(i));
      FrankArc.devReset();
      FrankArc.devForgive();
      const a = FrankArc.resolution();
      FrankArc.devReject();
      const b = FrankArc.resolution();
      FrankArc.devReset();
      const c = FrankArc.resolution();
      return { missing, a, b, c };
    });
    ok(devOk.missing.length === 0, 'DEV: все восемь кнопок линии на месте' +
       (devOk.missing.length ? ' — нет ' + devOk.missing.join(', ') : ''));
    ok(devOk.a === 'FORGIVEN' && devOk.b === 'REJECTED' && devOk.c === 'NONE',
       'DEV: кнопки меняют настоящее состояние линии (' + [devOk.a, devOk.b, devOk.c].join(' → ') + ')');

    return true;
  });
}

main().then(() => {
  notes.forEach(n => console.log(n));
  const errs = H.errors.filter(e => !/favicon|net::ERR_FILE/.test(e));
  if (errs.length) { console.log('\nОшибки страницы:'); errs.forEach(e => console.log('  ! ' + e)); }
  if (fails.length || errs.length) {
    console.log('\nПРОВАЛЕНО: ' + fails.length + ' проверок');
    fails.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('\nВСЁ ПРОЙДЕНО: ' + notes.length + ' проверок');
}).catch(e => { console.error(e); process.exit(1); });
