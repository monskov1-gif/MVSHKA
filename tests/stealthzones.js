/* Кража: взаимодействие там, где нарисован предмет.

   Жалоба была ровно такая: «взаимодействия с предметами вообще в других
   местах». Причин было три, и каждую здесь ловит своя проверка:

   1. Зоны дома Розы стояли своими координатами и разъехались с мебелью.
      Теперь зона привязана к предмету (at:'id'), и проверяется, что от
      точки подхода до основания СВОЕГО предмета не дальше нескольких
      пикселей, что точка свободна и до неё можно дойти от входа.
   2. В доме Мадлен (зум 1.5) подсказка рисовалась без учёта зума и висела
      в стороне от предмета. Здесь кадр рисуется по-настоящему, рамка
      подсказки ищется в пикселях холста и сравнивается с положением
      предмета на экране.
   3. Соседняя зона перехватывала выбор. Стоя в точке подхода, игра
      обязана выбирать именно эту зону.

   И поведение, которое ломало кражу: из укрытия можно было уйти ногами и
   остаться невидимой, а хозяйка меняла этаж посреди комнаты, а не на
   лестнице. */
const H = require('./harness.js');

const FLOORS = {
  madeleine: ['madFloor1', 'madFloor2', 'madFloor3'],
  rosa:      ['roseFloor1', 'roseFloor2', 'roseFloor3'],
};
/* Дом Мадлен собран по обмерам с чертежа, и точки подхода там заданы
   планом; допуск шире, но не настолько, чтобы зона ушла к соседу. */
const LIMIT = { madeleine: 24, rosa: 12 };

async function main() {
  const out = [];
  const ok = m => { out.push('  ✓ ' + m); };
  const bad = [];
  const fail = m => { bad.push(m); out.push('  ✗ ' + m); };

  await H.run('ZONES', async page => {
    await H.newGame(page);

    for (const id of Object.keys(FLOORS)) {
      /* Миссия поднимается по-настоящему, но хозяйка снята: здесь
         проверяется геометрия, а не слежка. */
      await page.evaluate(async id => {
        Scene.abort();
        const def = Stealth.MISSIONS[id];
        await changeRoom(def.floors[def.start.floor], def.start.x, def.start.y);
        Stealth.begin(id);
        Stealth.music = () => {};
        Stealth.W.active = false;
      }, id);

      for (let fi = 0; fi < 3; fi++) {
        const key = FLOORS[id][fi];
        const r = await page.evaluate(async ([key, id, fi, LIM]) => {
          const room = Rooms[key], res = { far:[], stuck:[], cut:[], steal:[], n:0, near:[] };
          if (gameState.currentRoom !== key) await changeRoom(key, room.spawn.default[0], room.spawn.default[1]);
          /* Откуда игрок попадает на этаж: окно/сад/дверь на первом,
             лестничная площадка на остальных. */
          const def = Stealth.MISSIONS[id];
          const from = fi === 0 ? { x:def.start.x, y:def.start.y }
                                : (room.interactables.find(z => z.stairTo) || {}).stand;
          const rectOf = it => {
            if (it.prop) return PropZone.rect(it.prop);
            if (it.planAct && it.planAct.on) {
              const f = MADELEINE_HOUSE_PLAN.floors[room.madFloor];
              const o = f.furniture.find(q => q.id === it.planAct.on);
              return o && { x:o.x, y:o.y, w:o.w, h:o.h };
            }
            return null;
          };
          for (const it of room.interactables) {
            const kind = it.hide ? 'hide' : it.noise ? 'noise'
                       : (it.kind === 'search' || (it.planAct && it.planAct.kind === 'search')) ? 'search' : null;
            if (!kind) continue;
            res.n++;
            const sp = it.stand;
            const rc = rectOf(it);
            if (!rc) { res.far.push(it.name + ': нет предмета'); continue; }
            const dx = Math.max(rc.x - sp.x, 0, sp.x - (rc.x + rc.w));
            const dy = Math.max(rc.y - sp.y, 0, sp.y - (rc.y + rc.h));
            const d = Math.round(Math.hypot(dx, dy));
            res.near.push(d);
            if (d > LIM) res.far.push(`${it.name} «${it.prompt}» в ${d} px от своего предмета`);
            /* Точка подхода свободна... */
            const blocked = isBlocked(sp.x, sp.y);
            if (blocked) res.stuck.push(`${it.name} (${sp.x},${sp.y})`);
            /* ...до неё можно дойти от входа на этаж... */
            if (from && !blocked && !Stealth.nav.path(key, from, sp)) res.cut.push(it.name);
            /* ...и стоя в ней, игра выбирает именно эту зону. */
            Player.x = sp.x; Player.y = sp.y;
            const near = findNearestInteractable();
            if (!near || near.ref !== it)
              res.steal.push(`${it.name} → ${near ? (near.ref.name || near.ref.prompt) : 'ничего'}`);
          }
          return res;
        }, [key, id, fi, LIMIT[id]]);
        const worst = r.near.length ? Math.max(...r.near) : 0;
        if (r.far.length) fail(`${key}: зона не у своего предмета: ${r.far.join('; ')}`);
        else ok(`${key}: ${r.n} зон у своих предметов (дальше всех ${worst} px, допуск ${LIMIT[id]})`);
        if (r.stuck.length) fail(`${key}: точка подхода в мебели: ${r.stuck.join('; ')}`);
        else ok(`${key}: все точки подхода свободны`);
        if (r.cut.length) fail(`${key}: не дойти от входа: ${r.cut.join(', ')}`);
        else ok(`${key}: до каждой зоны можно дойти от входа на этаж`);
        if (r.steal.length) fail(`${key}: соседняя зона перехватывает выбор: ${r.steal.join('; ')}`);
        else ok(`${key}: в точке подхода выбирается своя зона`);
      }

      /* Подсказка на экране висит над предметом — и в доме с зумом тоже.
         Кадр рисуется настоящим drawRoom, рамка ищется по цвету. */
      const hint = await page.evaluate(async id => {
        const res = [];
        const def = Stealth.MISSIONS[id];
        for (const key of def.floors) {
          const room = Rooms[key];
          if (gameState.currentRoom !== key) await changeRoom(key, room.spawn.default[0], room.spawn.default[1]);
          const its = room.interactables.filter(z => z.mark && (z.hide || z.noise || z.kind === 'search' ||
                                                                (z.planAct && z.planAct.kind === 'search')));
          for (const it of its.slice(0, 4)) {
            Player.x = it.stand.x; Player.y = it.stand.y;
            Game.mode = 'explore';
            drawRoom();
            const cv = Game.canvas, k = cv.width / CONFIG.VIEW_W;
            const img = Game.ctx.getImageData(0, 0, cv.width, cv.height).data;
            let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
            for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
              const i = (y * cv.width + x) * 4;
              if (Math.abs(img[i] - 0xc0) < 8 && Math.abs(img[i + 1] - 0x30) < 8 && Math.abs(img[i + 2] - 0x4d) < 8) {
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
              }
            }
            if (x1 < 0) { res.push({ key, name:it.name, miss:true }); continue; }
            const Z = room.zoom || 1, cam = Game.cam;
            const want = { x:(it.mark.x - cam.x) * Z, y:(it.mark.y - cam.y) * Z };
            const got = { x:(x0 + x1) / 2 / k, y:(y0 + y1) / 2 / k };
            res.push({ key, name:it.name, dx:Math.round(got.x - want.x), dy:Math.round(got.y - want.y),
                       w:Math.round((x1 - x0) / k), Z });
          }
        }
        return res;
      }, id);
      const off = hint.filter(h => h.miss || Math.abs(h.dx) > h.w / 2 + 4 || Math.abs(h.dy) > 16);
      if (off.length) fail(`${id}: подсказка не над предметом: ${JSON.stringify(off.slice(0, 4))}`);
      else ok(`${id}: подсказка висит над предметом (${hint.length} замеров, зум ${hint[0] && hint[0].Z})`);

      await page.evaluate(() => { Scene.abort(); if (Stealth.on) Stealth.finish(false); });
      await page.waitForTimeout(150);
    }

    /* Тайники — это зоны у предметов. */
    const spots = await page.evaluate(() => {
      const def = Stealth.MISSIONS.rosa, res = [];
      def.spots.forEach(sp => {
        const it = Rooms[def.floors[sp.floor]].interactables.find(z => z.name === sp.id);
        res.push({ id:sp.id, ok:!!it && it.stand.x === sp.x && it.stand.y === sp.y, prop:it && it.prop && it.prop.t });
      });
      return res;
    });
    if (spots.every(s => s.ok)) ok('Роза: тайники стоят у комода, склянок и сундука (' + spots.map(s => s.id + '=' + s.prop).join(', ') + ')');
    else fail('Роза: тайник не совпадает с зоной: ' + JSON.stringify(spots));

    /* Укрытие: шаг — это выход, а не невидимая прогулка. Кнопка действия
       в укрытии — тоже выход. Рядом с хозяйкой Ная не двигается. */
    const hide = await page.evaluate(async () => {
      Scene.abort();
      const def = Stealth.MISSIONS.rosa;
      await changeRoom('roseFloor2', 344, 183);
      Stealth.begin('rosa'); Stealth.music = () => {};
      Stealth.W.active = false;
      const it = Rooms.roseFloor2.interactables.find(z => z.name === 'hideWardrobe');
      Player.x = it.stand.x; Player.y = it.stand.y;
      it.action();
      const r = { hidden:!!Stealth.hidden, pose:!!Player.pose };
      const getMove = Input.getMove;
      Input.getMove = () => ({ dx:1, dy:0 });
      Game.mode = 'explore';
      const x0 = Player.x;
      await new Promise(res => setTimeout(res, 250));
      r.afterMove = !!Stealth.hidden;
      r.moved = Math.round(Player.x - x0);
      r.poseAfter = !!Player.pose;
      Input.getMove = getMove;
      // кнопка действия в укрытии
      it.action();
      const hid2 = !!Stealth.hidden;
      doInteract();
      r.actionLeaves = hid2 && !Stealth.hidden;
      // рядом с хозяйкой не выпускает и не двигает
      it.action();
      Stealth.W.active = true; Stealth.W.floor = 1; Stealth.W.x = Player.x + 10; Stealth.W.y = Player.y;
      const px = Player.x;
      Stealth.stirHidden();
      r.nearHolds = !!Stealth.hidden && Player.x === px;
      Stealth.W.active = false;
      Stealth.leaveHide();
      Stealth.finish(false);
      return r;
    });
    if (hide.hidden && hide.pose) ok('укрытие прячет, Ная присела');
    else fail('укрытие не прячет: ' + JSON.stringify(hide));
    if (!hide.afterMove && !hide.poseAfter) ok('шаг из укрытия выводит из него (невидимой по дому не ходит)');
    else fail('в укрытии можно ходить невидимой: ' + JSON.stringify(hide));
    if (hide.actionLeaves) ok('кнопка действия в укрытии — выход, а не соседний комод');
    else fail('кнопка действия в укрытии не выводит: ' + JSON.stringify(hide));
    if (hide.nearHolds) ok('рядом с хозяйкой Ная из укрытия не выходит');
    else fail('рядом с хозяйкой Ная выходит из укрытия: ' + JSON.stringify(hide));

    /* Хозяйка меняет этаж на лестнице и появляется у того же марша. */
    for (const id of ['madeleine', 'rosa']) {
      const hop = await page.evaluate(async id => {
        Scene.abort();
        const def = Stealth.MISSIONS[id];
        await changeRoom(def.floors[def.start.floor], def.start.x, def.start.y);
        Stealth.begin(id); Stealth.music = () => {};
        const W = Stealth.W, res = { hops:[], floors:new Set([W.floor]) };
        Stealth.hidden = { x:Player.x, y:Player.y };            // слежка не мешает обходу
        let t = 0, prev = { f:W.floor, x:W.x, y:W.y };
        while (t < 600000 && res.hops.length < 7) {
          Stealth.update(40); t += 40;
          if (W.state !== 'PATROL') W.calm();
          if (W.floor !== prev.f) {
            const st = W.stairStand(prev.f, W.floor), arr = W.stairStand(W.floor, prev.f);
            res.hops.push({ from:prev.f, to:W.floor, t,
              left: st ? Math.round(Math.hypot(prev.x - st.x, prev.y - st.y)) : -1,
              came: arr ? Math.round(Math.hypot(W.x - arr.x, W.y - arr.y)) : -1 });
            res.floors.add(W.floor);
          }
          prev = { f:W.floor, x:W.x, y:W.y };
        }
        Stealth.hidden = null;
        Stealth.finish(false);
        return { hops:res.hops, floors:[...res.floors].sort() };
      }, id);
      const badHop = hop.hops.filter(h => h.left < 0 || h.left > 28 || h.came !== 0);
      if (!hop.hops.length) fail(`${id}: хозяйка не меняет этаж`);
      else if (badHop.length) fail(`${id}: смена этажа не на лестнице: ${JSON.stringify(badHop)}`);
      else ok(`${id}: ${hop.hops.length} переходов, все с площадки на площадку (${hop.hops.map(h => h.from + 1 + '→' + (h.to + 1)).join(' ')})`);
      if (hop.floors.length === 3) ok(`${id}: за обход она бывает на всех трёх этажах`);
      else fail(`${id}: обход не заходит на все этажи: ${hop.floors.join(',')}`);
    }
  });

  console.log(out.join('\n'));
  if (H.errors.length) { console.log('\nОшибки страницы:'); H.errors.forEach(e => console.log('  ! ' + e)); }
  if (bad.length || H.errors.length) { console.log(`\nПРОВАЛЕНО: ${bad.length} проверок`); process.exit(1); }
  console.log(`\nВСЁ ПРОЙДЕНО: ${out.length} проверок`);
}

main().catch(e => { console.error(String(e.stack || e)); process.exit(1); });
