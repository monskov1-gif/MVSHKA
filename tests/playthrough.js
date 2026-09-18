/* СКВОЗНОЕ ПРОХОЖДЕНИЕ обеих краж — как играл бы человек.

   Бот не телепортируется и ничего не отключает: он жмёт те же стрелки,
   ходит тем же tryMove, нажимает те же интерактивы и живёт в одном
   времени с хозяйкой дома. Проверяется ровно то, на что жаловались:
   лестница даёт подсказку и работает, на этаже не ловят мгновенно,
   укрытие прячет там, где стоишь, амулет находится, и из дома можно
   выйти. Прогон идёт в реальном времени — это медленно и так и надо. */
const H = require('./harness.js');

const BUDGET = 240000;             // сколько миллисекунд даём на одну кражу

async function playMission(page, id, tag) {
  return page.evaluate(async ([id, tag, BUDGET]) => {
    const L = [];
    const say = m => L.push(m);
    const t0 = performance.now();
    const left = () => BUDGET - (performance.now() - t0);

    const frame = () => new Promise(r => requestAnimationFrame(r));
    const pump = () => { if (Dialogue.active && !Dialogue.awaitingChoice) Dialogue.advance(); };

    /* Идём ногами: каждый кадр выбираем направление по найденному пути и
       держим соответствующие клавиши. Никаких присваиваний Player.x. */
    async function walk(tx, ty, ms) {
      const stop = performance.now() + (ms || 14000);
      let stuck = 0, lastD = 1e9, jiggle = 0;
      while (performance.now() < stop && left() > 0) {
        pump();
        const d = Math.hypot(Player.x - tx, Player.y - ty);
        if (d < 10) break;
        if (d > lastD - 0.15) stuck++; else stuck = 0;
        lastD = d;
        if (stuck > 150) { Input.keys = {}; return false; }
        const path = Stealth.nav.path(gameState.currentRoom, { x:Player.x, y:Player.y }, { x:tx, y:ty });
        /* Целимся строго в СЛЕДУЮЩУЮ клетку пути. Заглядывать дальше
           нельзя: в дверном проёме это срезает угол прямо в откос. А
           чтобы в проёме нажималась и вторая ось, порог низкий. */
        const n = (path && path.length) ? path[0] : { x:tx, y:ty };
        const dx = n.x - Player.x, dy = n.y - Player.y;
        Input.keys = {};
        if (dx < -0.5) Input.keys['ArrowLeft'] = true; else if (dx > 0.5) Input.keys['ArrowRight'] = true;
        if (dy < -0.5) Input.keys['ArrowUp'] = true;   else if (dy > 0.5) Input.keys['ArrowDown'] = true;
        /* Расклинивание: если стоим на месте, подталкиваем по свободной оси. */
        if (stuck > 20) {
          jiggle++;
          const side = (jiggle >> 3) & 1;
          Input.keys['ArrowUp'] = Input.keys['ArrowDown'] = false;
          Input.keys[side ? 'ArrowDown' : 'ArrowUp'] = true;
        }
        await frame();
      }
      Input.keys = {};
      return Math.hypot(Player.x - tx, Player.y - ty) < 14;
    }

    /* Свободная клетка, с которой интерактив точно сработает (то же
       правило, что и в findNearestInteractable: до прямоугольника <30). */
    function standFor(it) {
      const gr = Stealth.nav.grid(gameState.currentRoom);
      let best = null, bd = 1e9;
      for (let gy = 0; gy < gr.h; gy++) for (let gx = 0; gx < gr.w; gx++) {
        if (!Stealth.nav.free(gr, gx, gy)) continue;
        const x = gx * gr.C + gr.C / 2, y = gy * gr.C + gr.C / 2;
        const cx = Math.max(it.x, Math.min(x, it.x + it.w));
        const cy = Math.max(it.y, Math.min(y - 8, it.y + it.h));
        const d = Math.hypot(cx - x, cy - (y - 8));
        if (d < bd) { bd = d; best = { x, y, d }; }
      }
      return best;
    }

    function findIt(name) {
      return (Rooms[gameState.currentRoom].interactables || []).find(i => i.name === name);
    }

    async function use(name) {
      const it = findIt(name);
      if (!it) { say(`НЕТ интерактива «${name}» в ${gameState.currentRoom}`); return false; }
      const sp = standFor(it);
      if (!sp || sp.d >= 29) { say(`к «${it.prompt}» не подойти (${sp ? sp.d.toFixed(0) : '—'} px)`); return false; }
      if (!await walk(sp.x, sp.y, 16000)) { say(`не дошла до «${it.prompt}»`); return false; }
      /* Проверяем именно то, на что жаловались: подсказка обязана
         появиться сама, а не «мы знаем, что объект тут». */
      const near = findNearestInteractable();
      if (!near || near.ref !== it) {
        say(`стоя вплотную к «${it.prompt}» игра предлагает «${near ? (near.ref.prompt || near.ref.name) : 'ничего'}»`);
        return false;
      }
      doInteract();
      for (let i = 0; i < 40; i++) { pump(); await frame(); }
      return true;
    }

    /* Если заметили — уходим в ближайшее укрытие и пережидаем. */
    async function hideIfSeen() {
      if (!Stealth.on) return;
      if (Stealth.W.state !== 'CHASE' && Stealth.W.state !== 'ALERT') return;
      const hides = (Rooms[gameState.currentRoom].interactables || []).filter(i => i.hide);
      if (!hides.length) return;
      let best = null, bd = 1e9;
      for (const h of hides) {
        const d = Math.hypot(h.x + h.w / 2 - Player.x, h.y + h.h / 2 - Player.y);
        if (d < bd) { bd = d; best = h; }
      }
      say('заметили — ухожу в «' + best.prompt + '»');
      if (await use(best.name)) {
        const stop = performance.now() + 14000;
        while (performance.now() < stop && Stealth.W.state !== 'PATROL' && left() > 0) { pump(); await frame(); }
        if (Stealth.hidden) { doInteract(); for (let i = 0; i < 30; i++) { pump(); await frame(); } }
      }
    }

    /* Подъём по лестнице: если хозяйка над лестницей — игра говорит об
       этом, и бот честно ждёт, а не ломится. */
    async function climb(name) {
      for (let k = 0; k < 8 && left() > 0; k++) {
        const wasRoom = gameState.currentRoom;
        if (!await use(name)) return false;
        if (gameState.currentRoom !== wasRoom) return true;
        say('лестница занята — жду');
        const stop = performance.now() + 9000;
        while (performance.now() < stop && left() > 0) { pump(); await frame(); }
      }
      return false;
    }

    // ---------- сама кража ----------
    Scene.abort();
    const def = Stealth.MISSIONS[id];
    await changeRoom(def.floors[def.start.floor], def.start.x, def.start.y);
    Stealth.begin(id);
    say(`старт: ${gameState.currentRoom}, тайник «${Stealth.spot.id}» на этаже ${Stealth.spot.floor + 1}`);
    if (Game.mode !== 'explore') { say('режим не explore: ' + Game.mode); }

    const target = Stealth.spot.floor;
    for (let f = 0; f < target && left() > 0; f++) {
      await hideIfSeen();
      if (!await climb('up')) { say('не поднялась на этаж ' + (f + 2)); return L; }
      say(`поднялась: ${gameState.currentRoom}, хозяйка на этаже ${Stealth.W.floor + 1} (${Stealth.W.state})`);
      // сразу после подъёма нас не должно поймать
      for (let i = 0; i < 30; i++) { pump(); await frame(); }
      if (Stealth.caught > 0) say('ПОЙМАЛИ сразу после подъёма, попыток ' + Stealth.caught);
    }

    await hideIfSeen();
    // по дороге обыскиваем одно пустое место — поиск должен что-то говорить
    const others = (Rooms[gameState.currentRoom].interactables || [])
      .filter(i => !i.hide && !i.noise && i.name !== 'up' && i.name !== 'down' && i.name !== Stealth.spot.id);
    if (others.length) { await use(others[0].name); say('обыскала пустое место «' + others[0].prompt + '»'); }

    await hideIfSeen();
    if (!await use(Stealth.spot.id)) { say('не добралась до тайника'); return L; }
    say('амулет взят: ' + Stealth.taken + ', цель: «' + Stealth.goal + '»');
    if (!Stealth.taken) return L;

    for (let f = target; f > 0 && left() > 0; f--) {
      await hideIfSeen();
      if (!await climb('down')) { say('не спустилась с этажа ' + (f + 1)); return L; }
      say('спустилась: ' + gameState.currentRoom);
    }

    await hideIfSeen();
    const exit = id === 'rosa' ? 'garden' : 'window';
    if (!await use(exit)) { say('не вышла из дома'); return L; }
    const stop = performance.now() + 20000;
    while (performance.now() < stop && Stealth.on) { pump(); await frame(); }
    say('вышла: Stealth.on=' + Stealth.on + ', комната ' + gameState.currentRoom +
        ', поймана ' + Stealth.caught + '/3');
    say('время: ' + ((performance.now() - t0) / 1000).toFixed(0) + ' с');
    return L;
  }, [id, tag, BUDGET]);
}

async function main() {
  const res = await H.run('PLAY', async page => {
    await H.newGame(page);
    const out = {};
    for (const id of ['madeleine', 'rosa']) {
      out[id] = await playMission(page, id, id);
      await page.evaluate(() => { Scene.abort(); if (Stealth.on) Stealth.finish(false); Input.keys = {}; });
      await page.waitForTimeout(400);
    }
    return out;
  });
  let bad = 0;
  for (const id of Object.keys(res)) {
    console.log('--- ' + id + ' ---');
    res[id].forEach(l => console.log('  ' + l));
    const txt = res[id].join('\n');
    if (!/амулет взят: true/.test(txt)) { console.log('  ПРОВАЛ: амулет не взят'); bad++; }
    if (!/вышла: Stealth.on=false/.test(txt)) { console.log('  ПРОВАЛ: из дома не вышла'); bad++; }
    if (/НЕТ интерактива|не подойти|игра предлагает/.test(txt)) { console.log('  ПРОВАЛ: интерактив не сработал'); bad++; }
  }
  if (H.errors.length) { console.log('ОШИБКИ:'); H.errors.forEach(e => console.log('  ' + e)); bad++; }
  console.log(bad ? 'ПРОХОЖДЕНИЕ: ПРОВАЛ' : 'ПРОХОЖДЕНИЕ: обе кражи пройдены');
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
