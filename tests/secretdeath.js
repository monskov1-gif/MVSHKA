/* СЕКРЕТНАЯ ПЯТАЯ КОНЦОВКА — «НЕСЧАСТНЫЙ СЛУЧАЙ».

   Пасхалку легко сделать так, что она либо не срабатывает никогда, либо
   срабатывает сама по себе и портит прохождение. Поэтому проверяется и
   то и другое.

   ЧТО ДОЛЖНО СРАБАТЫВАТЬ (4 положительных случая):
     1. простоять на проезжей части десять секунд;
     2. простоять на сцене под люстрой все три предупреждения;
     3. опереться на расшатанный парапет, выбрав это в диалоге;
     4. подойти к студенту у лестницы шестой раз, стоя на площадке.

   ЧЕГО ПРОИСХОДИТЬ НЕ ДОЛЖНО (5 отрицательных):
     1. дорогу можно спокойно перейти;
     2. со сцены можно уйти, и счётчик остынет;
     3. «отойти» у парапета — это именно отойти;
     4. со студентом можно говорить сколько угодно вдали от лестницы;
     5. система молчит в чужих комнатах, в диалоге, в сцене, в краже и
        когда её выключили.

   Плюс: пятая концовка НЕ стирает сохранение и НЕ ставит сюжетный флаг
   конца, старые META без её полей грузятся без ошибок, а четыре основные
   концовки ведут себя ровно как раньше.

   Запуск: node tests/secretdeath.js                                   */
const H = require('./harness.js');

const fails = [];
const notes = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else notes.push('  ✓ ' + msg); };

/* Дождаться карточки концовки, продолжая вести диалог, как игрок.
   Ничего не двигает: пока идёт отсчёт, Ная стоит там, где стояла. */
async function pumpUntilEnding(page, ms, tag) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate(() => ({
      shown: document.getElementById('endingScreen').classList.contains('show'),
      dlg: Dialogue.active, choice: Dialogue.awaitingChoice,
      n: document.querySelectorAll('#choiceOptions .choiceOpt').length,
    }));
    if (st.shown) return true;
    if (st.choice && st.n) {
      await page.evaluate(() => document.querySelectorAll('#choiceOptions .choiceOpt')[0].click());
      await page.waitForTimeout(220); continue;
    }
    if (st.dlg) { await page.evaluate(() => Dialogue.advance()); await page.waitForTimeout(40); continue; }
    await page.waitForTimeout(120);
  }
  return false;
}

/* Довести игру до обычного играбельного состояния в нужной комнате.
   Ничего не подменяем: те же changeRoom, тот же reset, что и в игре. */
async function goto(page, room, x, y, tag) {
  await page.evaluate(async a => {
    Scene.abort();
    if (Dialogue.active && Dialogue.cancel) Dialogue.cancel();
    Game.mode = 'explore';
    await changeRoom(a.room, a.x, a.y);
  }, { room, x, y });
  await H.pump(page, [], tag);
  return page.evaluate(a => {
    SecretDeathSystem.reset();
    SecretDeathSystem.state.grace = 0;
    Player.x = a.x; Player.y = a.y;
    saveGame();
    return { room: gameState.currentRoom, x: Player.x, y: Player.y };
  }, { x, y });
}

/* Общая проверка карточки после любого из четырёх случаев. */
async function cardCheck(page, kind, tag) {
  const st = await page.evaluate(k => ({
    shown: document.getElementById('endingScreen').classList.contains('show'),
    roman: document.getElementById('endingRoman').textContent,
    name:  document.getElementById('endingName').textContent,
    body:  document.getElementById('endingBody').textContent,
    loadBtn: document.getElementById('btnEndLoad').style.display !== 'none',
    save:  !!localStorage.getItem(CONFIG.SAVE_KEY),
    endFlag: !!gameState.flags.ending,
    metaV: !!META.endings.V,
    seen:  META.secretDeaths ? !!META.secretDeaths[k] : false,
    seenCount: SecretDeathSystem.seenCount(),
    main:  ['I','II','III','IV'].filter(i => META.endings[i]),
  }), kind);
  ok(st.shown, tag + ': карточка концовки показана');
  ok(st.roman === 'НЕСЧАСТНЫЙ СЛУЧАЙ', tag + ': это карточка пятой концовки (' + st.roman + ')');
  ok(st.body.length > 20, tag + ': на карточке написано, что произошло');
  ok(st.save, tag + ': сохранение НЕ стёрто');
  ok(!st.endFlag, tag + ': сюжетный флаг конца НЕ поставлен');
  ok(st.metaV, tag + ': концовка V записана в META');
  ok(st.seen, tag + ': случай «' + kind + '» отмечен пройденным');
  ok(st.loadBtn, tag + ': кнопка «продолжить с сохранения» видна');
  ok(st.main.length === 0, tag + ': основные концовки не задеты (' + st.main.join(',') + ')');
  return st;
}

/* Вернуться в игру той же кнопкой, что и игрок. */
async function continueFromCard(page) {
  await page.click('#btnEndLoad');
  await page.waitForTimeout(900);
  return page.evaluate(() => ({
    mode: Game.mode, shown: document.getElementById('endingScreen').classList.contains('show'),
    ending: Game.endingShown, room: gameState && gameState.currentRoom,
  }));
}

async function main() {
  await H.run('SECRET', async page => {
    await H.newGame(page);
    /* Университет открыт, Сью жива: в этом состоянии существуют все
       четыре комнаты и студент у лестницы. */
    await page.evaluate(() => {
      Object.assign(gameState.flags, {
        prologueComplete:true, backstoryDone:true, prologBackstoryStarted:true,
        cafeShiftFinished:true, uniArrived:true, sawFloor2:true,
      });
      gameState.counters.uniDay = 2;
    });

    /* ================= АССЕТЫ ================= */
    const art = await page.evaluate(() => {
      const keys = ['uni_chandelier','traffic_car_a','traffic_car_b','traffic_car_c','rail_weak'];
      return keys.map(k => {
        const d = Art.defs[k];
        if (!d) return { k, ok:false, why:'нет модели' };
        const img = Art.get(k);
        if (!img) return { k, ok:false, why:'не рисуется' };
        const g = img.getContext('2d');
        const px = g.getImageData(0, 0, img.width, img.height).data;
        let solid = 0, colours = new Set();
        for (let i = 0; i < px.length; i += 4) if (px[i+3] > 24) {
          solid++; colours.add(px[i] + ',' + px[i+1] + ',' + px[i+2]);
        }
        return { k, ok:solid > 60 && colours.size > 3, w:img.width, h:img.height,
                 solid, colours:colours.size };
      });
    });
    art.forEach(a => ok(a.ok, 'ассет ' + a.k + ': ' + (a.ok
      ? a.w + '×' + a.h + ', ' + a.solid + ' пикселей, ' + a.colours + ' цветов'
      : (a.why || 'слишком пусто: ' + a.solid + ' пикселей, ' + a.colours + ' цветов'))));

    /* ================= ОТРИЦАТЕЛЬНЫЕ 5: защиты и белый список ========= */
    await goto(page, 'uniTheatre', 170, 300, 'guards');   // в зале, не на сцене
    const guards = await page.evaluate(() => {
      const S = SecretDeathSystem, out = {};
      out.wrongRoom = S.canTrigger('CAR_ACCIDENT');           // дорога в театре
      out.allowedHere = S.allowed();
      Dialogue.active = true;  out.inDialogue = S.canTrigger('CHANDELIER'); Dialogue.active = false;
      Scene.active = true;     out.inScene    = S.canTrigger('CHANDELIER'); Scene.active = false;
      Stealth.on = true;       out.inStealth  = S.canTrigger('CHANDELIER'); Stealth.on = false;
      Game.mode = 'menu';      out.inMenu     = S.canTrigger('CHANDELIER'); Game.mode = 'explore';
      Game.chase = { active:true, resolved:false };
      out.inChase = S.canTrigger('CHANDELIER'); Game.chase = null;
      gameState.flags.ending = true; out.afterEnding = S.canTrigger('CHANDELIER');
      delete gameState.flags.ending;
      S.disable();             out.disabled   = S.canTrigger('CHANDELIER'); S.enable();
      out.unknown = S.canTrigger('SOMETHING_ELSE');
      out.zoneOffStage = S.isDangerousZone();                 // в зале — не опасно
      out.okHere = S.canTrigger('CHANDELIER');
      out.isAllowedFn = isSecretDeathAllowed();
      return out;
    });
    ok(!guards.wrongRoom,  'белый список: дорога невозможна в театре');
    ok(!guards.inDialogue, 'защита: не срабатывает в диалоге');
    ok(!guards.inScene,    'защита: не срабатывает в катсцене');
    ok(!guards.inStealth,  'защита: не срабатывает во время кражи');
    ok(!guards.inMenu,     'защита: не срабатывает в меню');
    ok(!guards.inChase,    'защита: не срабатывает в погоне');
    ok(!guards.afterEnding,'защита: не срабатывает после концовки');
    ok(!guards.disabled,   'disable(): система молчит');
    ok(!guards.unknown,    'неизвестный тип случая отвергается');
    ok(!guards.zoneOffStage,'в зрительном зале зона не опасная');
    ok(guards.okHere && guards.isAllowedFn, 'в обычной игре система разрешена');

    /* система не считает ничего в комнате, которой нет в белом списке */
    await goto(page, 'uniHall', 220, 300, 'whitelist');
    await page.waitForTimeout(2500);
    const idle = await page.evaluate(() => SecretDeathSystem.getDebugState());
    ok(idle.road.startsWith('0.0') && idle.chandelier.startsWith('0.0'),
       'в чужой комнате счётчики стоят на нуле (' + idle.road + ' / ' + idle.chandelier + ')');

    /* ================= ОТРИЦАТЕЛЬНЫЙ 1: дорогу можно перейти ========= */
    await goto(page, 'street', 320, 200, 'road-cross');
    await page.waitForTimeout(4000);
    const crossed = await page.evaluate(() => {
      const before = SecretDeathSystem.state.roadTimer;
      Player.y = 275;                                   // сошла на тротуар
      return { before, ending:Game.endingShown };
    });
    await page.waitForTimeout(1500);
    const afterCross = await page.evaluate(() => ({
      timer: SecretDeathSystem.state.roadTimer, ending: Game.endingShown,
      cars: SecretDeathSystem.Road.cars.length,
    }));
    ok(!crossed.ending && !afterCross.ending, 'дорогу можно перейти: концовки нет');
    ok(crossed.before > 2 && crossed.before < 8,
       'за четыре секунды счётчик дошёл до ' + crossed.before.toFixed(1) + ', а не до порога');
    ok(afterCross.timer < crossed.before, 'сойдя с дороги, счётчик обнулился');
    ok(afterCross.cars > 0, 'поток машин живёт сам по себе (' + afterCross.cars + ' на экране)');

    /* ================= ПОЛОЖИТЕЛЬНЫЙ 1: машина ================= */
    await goto(page, 'street', 320, 200, 'road-stand');
    const r1 = await pumpUntilEnding(page, 16000, 'road');
    ok(r1, 'дорога: стоять десять секунд — концовка наступает');
    if (r1) await cardCheck(page, 'car', 'дорога');
    const back = await continueFromCard(page);
    ok(!back.shown && back.mode === 'explore' && !back.ending,
       'после карточки игра продолжается с сохранения (' + back.room + ')');

    /* ================= ОТРИЦАТЕЛЬНЫЙ 2: со сцены можно уйти ========= */
    await goto(page, 'uniTheatre', 170, 150, 'stage-leave');
    await page.waitForTimeout(10500);                   // два предупреждения из трёх
    const mid = await page.evaluate(() => {
      const s = SecretDeathSystem.state;
      Player.y = 300;                                   // сошла в зал
      return { level:s.chandelierWarningLevel, timer:s.chandelierTimer, ending:Game.endingShown };
    });
    await page.waitForTimeout(3000);
    const cooled = await page.evaluate(() => ({
      timer: SecretDeathSystem.state.chandelierTimer, ending: Game.endingShown,
      state: SecretDeathSystem.chandelier.state,
    }));
    ok(!mid.ending && !cooled.ending, 'со сцены можно уйти: концовки нет');
    ok(mid.level >= 1 && mid.level < 3,
       'за десять секунд успело пройти ' + mid.level + ' предупреждения из трёх');
    ok(cooled.timer < mid.timer, 'вне сцены счётчик люстры остывает (' +
       mid.timer.toFixed(1) + ' → ' + cooled.timer.toFixed(1) + ')');

    /* ================= ПОЛОЖИТЕЛЬНЫЙ 2: люстра ================= */
    await goto(page, 'uniTheatre', 170, 150, 'stage-stand');
    const r2 = await pumpUntilEnding(page, 30000, 'chandelier');
    ok(r2, 'люстра: три предупреждения и падение — концовка наступает');
    if (r2) await cardCheck(page, 'chandelier', 'люстра');
    await continueFromCard(page);

    /* ================= ОТРИЦАТЕЛЬНЫЙ 3: «отойти» у парапета ========= */
    await goto(page, 'uniRoof', 290, 118, 'rail-safe');
    await H.step(page, 'obj', 'weakRail', [], 'rail-safe');       // первый осмотр
    await H.step(page, 'obj', 'weakRail', [1], 'rail-safe');      // «отойти»
    await page.waitForTimeout(3200);                              // triggerSoon успел бы
    const safe = await page.evaluate(() => ({
      state: SecretDeathSystem.state.balconyState,
      looks: SecretDeathSystem.state.balconyLooks,
      ending: Game.endingShown, mode: Game.mode,
    }));
    ok(!safe.ending, 'у парапета можно отойти: концовки нет');
    ok(safe.state === 'SAFE', 'после «отойти» перила снова SAFE (было ' + safe.state + ')');
    ok(safe.looks === 2, 'осмотры посчитаны: ' + safe.looks);
    ok(safe.mode === 'explore', 'управление у игрока');

    /* ================= ПОЛОЖИТЕЛЬНЫЙ 3: перила ================= */
    await H.step(page, 'obj', 'weakRail', [0], 'rail-fall');       // «опереться»
    const r3 = await pumpUntilEnding(page, 12000, 'rail');
    ok(r3, 'перила: опереться на расшатанный камень — концовка наступает');
    if (r3) await cardCheck(page, 'balcony', 'перила');
    await continueFromCard(page);

    /* ========== ОТРИЦАТЕЛЬНЫЙ 4: студент вдали от лестницы ========== */
    await goto(page, 'uniCorr2', 120, 200, 'student-far');
    const far = await page.evaluate(async () => {
      const n = Rooms.uniCorr2.npcs.find(x => x.name === 'Студент у лестницы');
      const out = { found:!!n, zone:null, ending:false };
      if (!n) return out;
      for (let i = 0; i < 9; i++) {
        Player.x = 120; Player.y = 200;                 // далеко от площадки
        out.zone = SecretDeathSystem.Stair.playerInsideStairDangerZone();
        n.dialogue();
        if (Dialogue.active) Dialogue.cancel ? Dialogue.cancel() : (Dialogue.active = false);
      }
      out.annoy = SecretDeathSystem.state.studentAnnoyance;
      out.ending = Game.endingShown;
      out.active = SecretDeathSystem.state.activeEvent;
      out.triggered = SecretDeathSystem.state.triggered;
      /* cancel() гасит окно, но режим возвращает end(): здесь диалоги
         обрываются снаружи, поэтому режим возвращаем сами. */
      Game.mode = 'explore';
      return out;
    });
    ok(far.found, 'студент у лестницы существует в комнате');
    ok(!far.zone, 'в середине коридора игрок вне опасной зоны');
    ok(!far.ending && !far.active && !far.triggered,
       'девять разговоров вдали от лестницы ничем не кончаются (раздражение ' +
       far.annoy + ', событие ' + far.active + ')');

    /* ================= ПОЛОЖИТЕЛЬНЫЙ 4: студент ================= */
    await goto(page, 'uniCorr2', 340, 240, 'student-near');
    /* Встаём туда же, куда встаёт игрок, подойдя к студенту: у самого
       NPC. Жёсткие координаты тут врут — мимо может идти другой
       студент, и тогда разговор достанется ему. */
    const inZone = await page.evaluate(() => {
      const n = roomNPCs(Rooms.uniCorr2).find(x => x.name === 'Студент у лестницы');
      Player.x = n.x; Player.y = n.y + 9;
      return { zone:SecretDeathSystem.Stair.playerInsideStairDangerZone(), x:Player.x, y:Player.y };
    });
    ok(inZone.zone, 'подойдя к студенту, игрок стоит в опасной зоне (' +
       inZone.x + ',' + inZone.y + ')');
    for (let i = 0; i < 5; i++)
      await H.step(page, 'npc', 'Студент у лестницы', [], 'student#' + (i + 1));
    const beforePush = await page.evaluate(() => ({
      annoy: SecretDeathSystem.state.studentAnnoyance, ending: Game.endingShown }));
    ok(!beforePush.ending, 'после пяти разговоров ещё ничего не произошло');
    ok(beforePush.annoy === 5, 'раздражение дошло до порога: ' + beforePush.annoy);
    const sixth = await H.useNpc(page, 'Студент у лестницы');
    ok(sixth === 'ok', 'шестой подход состоялся: ' + sixth);
    const r4 = await pumpUntilEnding(page, 14000, 'stair');
    ok(r4, 'студент: шестой подход у лестницы — концовка наступает');
    if (r4) {
      const st = await cardCheck(page, 'stairs', 'студент');
      ok(st.seenCount === 4, 'все четыре случая засчитаны: ' + st.seenCount + '/4');
    }
    await continueFromCard(page);

    /* ========== ГАЛЕРЕЯ и счётчик концовок в меню ========== */
    const gallery = await page.evaluate(() => {
      Endings.renderList(); updateEndingCount();
      const items = [...document.querySelectorAll('#endingsList .listItem')].map(b => ({
        idx: b.querySelector('.idx').textContent,
        name: b.children[1].textContent,
        locked: b.classList.contains('locked'),
      }));
      return { items, count: document.getElementById('menuEndCount').textContent };
    });
    ok(gallery.items.length === 5, 'в галерее пять строк, а не четыре');
    const v = gallery.items[4];
    ok(v && v.idx === 'V' && !v.locked, 'открытая пятая показана как V (' + (v && v.idx) + ')');
    ok(/КОНЦОВКИ: 0 \/ 4/.test(gallery.count) && /\?\?\?/.test(gallery.count),
       'счётчик в меню: «' + gallery.count + '»');

    /* ========== СТАРЫЕ СОХРАНЕНИЯ: полей нет — всё закрыто ========== */
    const legacy = await page.evaluate(() => {
      localStorage.setItem(CONFIG.META_KEY, JSON.stringify({
        endings:{ I:true }, memories:{}, endingStats:{}, hints:{} }));
      loadMeta();
      SecretDeathSystem.load();
      Endings.renderList();
      const items = [...document.querySelectorAll('#endingsList .listItem')].map(b => ({
        idx:b.querySelector('.idx').textContent, locked:b.classList.contains('locked') }));
      return { unlocked:SecretDeathSystem.state.endingUnlocked,
               seen:SecretDeathSystem.seenCount(),
               fifth:items[4], rows:items.length };
    });
    ok(!legacy.unlocked && legacy.seen === 0, 'старое META: пасхалка закрыта, случаев 0');
    ok(legacy.rows === 5 && legacy.fifth.idx === '???' && legacy.fifth.locked,
       'до открытия пятая строка — «???» и заперта (' + legacy.fifth.idx + ')');

    /* ========== ЧЕТЫРЕ ОСНОВНЫЕ КОНЦОВКИ НЕ ИЗМЕНИЛИСЬ ========== */
    const mainEnding = await page.evaluate(async () => {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(serializeState()));
      Game.endingShown = false;
      delete gameState.flags.ending;
      await Endings.show('I');
      return {
        flag: !!gameState.flags.ending,
        save: !!localStorage.getItem(CONFIG.SAVE_KEY),
        roman: document.getElementById('endingRoman').textContent,
        loadBtn: document.getElementById('btnEndLoad').style.display,
      };
    });
    ok(mainEnding.flag, 'концовка I по-прежнему ставит сюжетный флаг конца');
    ok(!mainEnding.save, 'концовка I по-прежнему стирает сохранение');
    ok(mainEnding.roman === 'КОНЦОВКА I', 'карточка концовки I не задета');
    ok(mainEnding.loadBtn === 'none', 'после основной концовки «продолжить» скрыто');

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
