/* Собеседника должно быть видно.

   Видимость NPC пересчитывается каждый кадр по его when(), а сцена по
   дороге ставит флаги — и персонаж исчезал из комнаты посреди
   собственных реплик. Виднее всего это было в выборе Сью: первой же
   командой сцена ставит persuasionDone, условие «Сью стоит в комнате»
   становится ложным, и дальше восемь реплик читались при пустой
   комнате. Тех же граблей набиралось одиннадцать сцен.

   Проверяется три вещи: сам механизм удержания, живой прогон обеих
   веток разговора со Сью (на каждой реплике чиби обязана быть в
   комнате) и портреты — у каждой реплики в игре должен найтись портрет
   ровно с тем выражением, которое она просит. Иначе окно диалога
   прячет портрет, и текст идёт при пустой рамке.

   Запуск: node tests/chibi.js                                        */
const H = require('./harness.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const res = await H.run('CHIBI', async page => {
    await H.newGame(page);

    /* --- 1. механизм: во время сцены никто не пропадает --- */
    const hold = await page.evaluate(async () => {
      Object.assign(gameState.flags, {
        returnedFromHell1:true, toldSueWitch:true, communeIntro:true,
        persuasionDone:false, sueAgreed:false, sueRefused:false });
      await changeRoom('nayaRoom', 120, 200);
      const room = Rooms.nayaRoom;
      const sue = () => roomNPCs(room).some(n => n.sprite === 'sue');
      const r = { before:sue() };
      Scene.active = true; Hold.begin();
      r.inScene = sue();
      setFlag('persuasionDone');            // ровно то, что делает сцена выбора
      r.afterFlag = sue();                  // held: Сью обязана остаться
      Scene.active = false; Hold.end();
      r.afterScene = sue();                 // сцена кончилась — можно уходить
      setFlag('persuasionDone', false);
      return r;
    });

    /* --- 2. живой прогон: обе ветки выбора Сью --- */
    const runBranch = async (respected) => page.evaluate(async (respected) => {
      Scene.abort();
      Object.assign(gameState.flags, {
        returnedFromHell1:true, toldSueWitch:true, communeIntro:true,
        persuasionDone:false, sueAgreed:false, sueRefused:false, lonerStart:false });
      gameState.scenesSeen = [];
      gameState.counters.persuadeStep = 3;
      gameState.counters.sueRespected = respected;   // 3 — отказ, 0 — согласие
      gameState.counters.sueResolve = respected ? 0 : 3;
      await changeRoom('nayaRoom', 120, 200);
      Game.mode = 'explore'; Game.paused = false;
      window.__lines = [];
      const orig = Dialogue._loadLine.bind(Dialogue);
      Dialogue._loadLine = function () {
        const r = orig();
        const L = this.currentLine;
        if (L && L.who) {
          const room = Rooms[gameState.currentRoom];
          const here = roomNPCs(room).map(n => n.sprite)
            .concat((Game.cast || []).map(n => n.sprite));
          window.__lines.push({ who:L.who, seen:here.indexOf(L.who) >= 0,
                                room:gameState.currentRoom });
        }
        return r;
      };
      Scene.play('persuadeSue');
    }, respected);

    /* Листать диалог умеет харнесс: он знает и карточки глав, и
       выборы, и монтажи. Свой цикл на это не годится. */
    const branches = {};
    for (const [tag, respected] of [['отказ', 3], ['согласие', 0]]) {
      await runBranch(respected);
      let done = true;
      try { await H.pump(page, [0, 0, 0, 0, 0, 0], 'CHIBI:' + tag); }
      catch (e) { done = false; console.log('  pump: ' + e.message.slice(0, 120)); }
      branches[tag] = await page.evaluate(d => ({
        done:d, lines:window.__lines,
        agreed:F('sueAgreed'), refused:F('sueRefused'),
      }), done);
      await page.evaluate(() => { Scene.abort(); Dialogue.cancel(); });
      await page.waitForTimeout(200);
    }
    /* --- 3. портреты: у каждой реплики своё лицо --- */
    const have = await page.evaluate(() => Object.keys(Assets.portraitURL));
    return { hold, branches, have };
  });

  /* Реплики берутся из исходника: пройти их все в игре нельзя, а
     проверить обязан каждый. */
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const have = new Set(res.have);
  const used = new Map();
  const re = /\{\s*who:\s*'([A-Za-z0-9_]+)'(?:\s*,\s*expr:\s*'([A-Za-z0-9_]+)')?/g;
  for (let m; (m = re.exec(src)); ) {
    const key = m[1] + '_' + (m[2] || 'normal');
    used.set(key, (used.get(key) || 0) + 1);
  }
  const noFace = [], wrongFace = [];
  used.forEach((n, key) => {
    if (have.has(key)) return;
    (have.has(key.replace(/_[a-z]+$/, '_normal')) ? wrongFace : noFace).push(key + ' ×' + n);
  });

  let bad = 0;
  const h = res.hold;
  console.log('--- удержание состава ---');
  console.log(`  до сцены Сью видна: ${h.before}`);
  console.log(`  в сцене: ${h.inScene}`);
  console.log(`  после флага persuasionDone внутри сцены: ${h.afterFlag}`);
  console.log(`  после конца сцены: ${h.afterScene}`);
  if (!h.before || !h.inScene) { console.log('  ПРОВАЛ: Сью не видна до начала'); bad++; }
  if (!h.afterFlag) { console.log('  ПРОВАЛ: флаг убрал Сью прямо посреди сцены'); bad++; }
  if (h.afterScene) { console.log('  ПРОВАЛ: после сцены Сью осталась, хотя не должна'); bad++; }

  for (const tag of Object.keys(res.branches)) {
    const b = res.branches[tag];
    console.log(`--- ветка «${tag}» ---`);
    console.log(`  доиграна: ${b.done}, согласилась: ${b.agreed}, отказалась: ${b.refused}, реплик: ${b.lines.length}`);
    if (!b.done) { console.log('  ПРОВАЛ: разговор не доигрался'); bad++; }
    const sue = b.lines.filter(l => l.who === 'sue');
    const blind = sue.filter(l => !l.seen);
    console.log(`  реплик Сью: ${sue.length}, из них без чиби в комнате: ${blind.length}`);
    if (!sue.length) { console.log('  ПРОВАЛ: Сью вообще не говорила'); bad++; }
    if (blind.length) { console.log('  ПРОВАЛ: Сью говорит, а её не видно'); bad++; }
  }
  console.log('--- портреты ---');
  console.log(`  портретов: ${have.size}, пар «кто+выражение» в репликах: ${used.size}`);
  if (noFace.length) {
    console.log('  ПРОВАЛ: реплики без портрета вовсе — окно прячет лицо:');
    noFace.forEach(x => console.log('    ' + x)); bad++;
  }
  if (wrongFace.length) {
    console.log('  ПРОВАЛ: выражения нет, подставится normal:');
    wrongFace.forEach(x => console.log('    ' + x)); bad++;
  }
  if (!noFace.length && !wrongFace.length) console.log('  у каждой реплики своё лицо');
  if (H.errors.length) { console.log('ОШИБКИ:'); H.errors.forEach(e => console.log('  ' + e)); bad++; }
  console.log('');
  console.log(bad ? 'СОБЕСЕДНИК: ПРОВАЛ (' + bad + ')' : 'СОБЕСЕДНИК: видно всех, кто говорит');
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
