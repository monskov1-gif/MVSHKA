/* Кража со взломом: механика, а не сюжет.

   Проверяется ровно то, на чём держится честность слежки: хозяйка ходит
   по своему этажу и не проходит сквозь стены, видит только то, что
   попадает в конус и не закрыто перегородкой, слышит шум, реагирует не
   мгновенно, теряет Наю в укрытии, а Сью действительно уводит её с
   места. Время прокручивается вручную через Stealth.update — прогон
   получается быстрым и одинаковым от запуска к запуску. */
const H = require('./harness.js');

const MISSIONS = ['madeleine', 'rosa'];

async function boot(page, id) {
  return page.evaluate(async (id) => {
    Scene.abort();
    const def = Stealth.MISSIONS[id];
    await changeRoom(def.floors[def.start.floor], def.start.x, def.start.y);
    Stealth.begin(id);
    /* Музыкальные слои к механике отношения не имеют, а пересборка
       секвенсора на каждом скачке тревоги делает прокрутку времени
       непозволительно медленной. */
    Stealth.music = () => {};
    return { floors:def.floors.slice(), spots:(def.spots||[]).map(s=>s.id), sue:def.sue||0 };
  }, id);
}

/* Прокрутка модельного времени без ожидания реального. */
/* Прокрутка модельного времени кусками по 10 секунд: один evaluate на всю
   минуту держит страницу заблокированной и валит прогон по таймауту. */
async function sim(page, ms, dt = 32) {
  const bad = [];
  for (let done = 0; done < ms; done += 10000) {
    const part = await page.evaluate(([ms, dt, base]) => {
      const bad = [];
      /* Обход проверяется отдельно от обнаружения: иначе хозяйка просто
         видит Наю, уходит в погоню и по маршруту больше не идёт. Прячем
         Наю на время замера — зрение проверяется своим тестом. */
      Stealth.hidden = { x:Player.x, y:Player.y };
      for (let t = 0; t < ms; t += dt) {
        Stealth.update(dt);
        const W = Stealth.W;
        if (W.active && W.solid(W.x, W.y))
          bad.push({ t:base + t, x:Math.round(W.x), y:Math.round(W.y), floor:W.floor });
      }
      Stealth.hidden = null;
      return bad.slice(0, 4);
    }, [Math.min(10000, ms - done), dt, done]);
    bad.push(...part);
    if (bad.length >= 4) break;
  }
  return bad.slice(0, 4);
}

async function main() {
  const res = await H.run('STEALTH', async page => {
    await H.newGame(page);
    const out = [];
    const fail = m => { throw new Error('STEALTH: ' + m); };

    for (const id of MISSIONS) {
      const def = await boot(page, id);
      const tag = id + ': ';
      const mark = m => process.stdout.write(`    · ${tag}${m}\n`);
      mark('миссия поднята');

      /* 0. Расстановка. Точка маршрута обязана стоять на свободной клетке:
            «дошла» считается по расстоянию до самой точки, и waypoint
            внутри стола заклинил бы весь обход. Тайник, наоборот, лежит
            В мебели — проверяется, что к нему можно подойти. */
      const данные = await page.evaluate((MID) => {
        const M = Stealth.MISSIONS[MID], bad = [];
        M.floors.forEach((key, fi) => {
          const gr = Stealth.nav.grid(key);
          (M.witch.routes[fi] || []).forEach((w, i) => {
            if (!Stealth.nav.free(gr, Math.floor(w.x / gr.C), Math.floor(w.y / gr.C)))
              bad.push(`${key}: точка ${i} (${w.x},${w.y}) стоит в мебели`);
          });
          if (!Rooms[key]) bad.push('нет комнаты ' + key);
        });
        /* Две зоны не должны спорить: игра выбирает по центру и радиусу
           30, и если центры ближе 34 пикселей, встать «только к одной»
           негде — именно так укрытие перекрывало лестницу. */
        M.floors.forEach(key => {
          const its = (Rooms[key].interactables || []);
          its.forEach((a, i) => its.forEach((c, j) => {
            if (j <= i) return;
            const d = Math.hypot((a.x + a.w/2) - (c.x + c.w/2), (a.y + a.h/2) - (c.y + c.h/2));
            if (d < 34) bad.push(`${key}: зоны «${a.prompt}» и «${c.prompt}» в ${d.toFixed(0)} px`);
          }));
        });
        (M.spots || []).forEach(sp => {
          const key = M.floors[sp.floor], gr = Stealth.nav.grid(key);
          const st = M.witch.routes[sp.floor][0];
          let ok = false;
          const box = { x:sp.x - 18, y:sp.y - 18, w:36, h:36 };
          for (let gy = Math.floor(box.y / gr.C); gy <= Math.floor((box.y + box.h) / gr.C) && !ok; gy++)
            for (let gx = Math.floor(box.x / gr.C); gx <= Math.floor((box.x + box.w) / gr.C) && !ok; gx++) {
              if (!Stealth.nav.free(gr, gx, gy)) continue;
              if (Stealth.nav.path(key, st, { x:gx * gr.C + gr.C / 2, y:gy * gr.C + gr.C / 2 })) ok = true;
            }
          if (!ok) bad.push(`${key}: к тайнику «${sp.id}» не подойти`);
          if (!(Rooms[key].interactables || []).some(it => it.name === sp.id))
            bad.push(`${key}: у тайника «${sp.id}» нет одноимённого интерактива`);
        });
        return bad;
      }, id);
      if (данные.length) fail(tag + данные.join('; '));
      mark('расстановка проверена');

      /* 1. Миссия поднялась и не держит сцену открытой. */
      const st0 = await page.evaluate(() => ({
        on:Stealth.on, spot:Stealth.spot && Stealth.spot.id, scene:Scene.active,
        dim:document.getElementById('actionBtn').classList.contains('dim'),
        sueBtn:document.getElementById('sueBtn').classList.contains('on'),
      }));
      if (!st0.on) fail(tag + 'миссия не запустилась');
      if (st0.scene) fail(tag + 'сцена осталась активной — кнопки погаснут');
      if (st0.dim) fail(tag + 'кнопки погашены во время кражи');
      if (def.spots.indexOf(st0.spot) < 0) fail(tag + 'тайник вне списка: ' + st0.spot);

      /* 2. Хозяйка обходит дом и ни разу не оказывается в стене. */
      const stuckIn = await sim(page, 40000);
      mark('обход 40 с пройден');
      if (stuckIn.length) fail(tag + 'хозяйка внутри стены: ' + JSON.stringify(stuckIn));
      const patrol = await page.evaluate(() => ({ wp:Stealth.W.wp, floor:Stealth.W.floor, state:Stealth.W.state }));

      /* Маршрут действительно продвигается: за минуту она обязана
         сменить хотя бы несколько точек, а не стоять в углу. */
      /* Круг обхода у Розы длиннее: дом больше и плечи маршрута по
         250–300 пикселей. Поэтому крутим не фиксированное время, а до
         тех пор, пока не наберём доказательств — или пока не выйдет
         запас в четыре минуты модельного времени. */
      const seen = { wps:new Set(), floors:new Set(), сек:0 };
      for (let k = 0; k < 24; k++) {
        const part = await page.evaluate(() => {
          Stealth.hidden = { x:Player.x, y:Player.y };
          if (Stealth.W.state !== 'PATROL') Stealth.W.calm();
          const s = new Set(), f = new Set();
          for (let t = 0; t < 10000; t += 32) { Stealth.update(32); s.add(Stealth.W.wp); f.add(Stealth.W.floor); }
          Stealth.hidden = null;
          return { wps:[...s], floors:[...f] };
        });
        part.wps.forEach(w => seen.wps.add(w));
        part.floors.forEach(f => seen.floors.add(f));
        seen.сек += 10;
        if (seen.wps.size >= 4 && seen.floors.size >= 2) break;
      }
      seen.wps = [...seen.wps].sort((a,b)=>a-b);
      seen.floors = [...seen.floors].sort();
      mark('обход ' + seen.сек + ' с: точки ' + seen.wps.join(',') + ', этажи ' + seen.floors.join(','));
      if (seen.wps.length < 4) fail(tag + 'обход не проходит маршрут, точки за ' + seen.сек + ' с: ' + seen.wps.join(','));
      if (seen.floors.length < 2) fail(tag + 'хозяйка не меняет этажи: ' + seen.floors.join(','));

      /* 3. Сквозь стены не видно. Ная ставится в конус, но за стену. */
      const sight = await page.evaluate(() => {
        const W = Stealth.W;
        /* За время замера обхода хозяйка могла уйти на другой этаж, а
           сквозь перекрытие она видеть и не должна. Возвращаем её к
           игроку — проверяем зрение, а не переходы между этажами. */
        const fi = Stealth.floorOf(gameState.currentRoom);
        if (W.floor !== fi) W.moveFloor(fi);
        Stealth.grace = 0;
        const room = Rooms[W.roomKey()];
        // на её этаж, иначе canSee отсекается ещё до проверки луча
        if (gameState.currentRoom !== W.roomKey()) return null;
        const r = {};
        // вплотную перед лицом — видит
        Player.x = W.x + Math.cos(W.dir) * 20; Player.y = W.y + Math.sin(W.dir) * 20;
        Stealth.hidden = null;
        r.near = W.canSee();
        // за ближайшей стеной на луче — не видит
        const wall = room.walls.find(w => w.w > 40 && w.h <= 10 && Math.abs(w.y - W.y) > 20);
        if (wall) {
          Player.x = Math.max(wall.x + 6, Math.min(wall.x + wall.w - 6, W.x));
          Player.y = wall.y + (wall.y > W.y ? 26 : -26);
          r.through = W.canSee();
          r.blocked = Stealth.blocksSight(W.x, W.y - 6, Player.x, Player.y);
        }
        // в укрытии не видит даже в упор
        Player.x = W.x + Math.cos(W.dir) * 16; Player.y = W.y + Math.sin(W.dir) * 16;
        Stealth.hidden = { x:Player.x, y:Player.y };
        r.hidden = W.canSee();
        Stealth.hidden = null;
        return r;
      });
      mark('зрение проверено');
      if (sight) {
        if (!sight.near) fail(tag + 'не видит Наю в упор перед собой');
        if (sight.hidden) fail(tag + 'видит Наю в укрытии');
        if (sight.blocked && sight.through) fail(tag + 'видит сквозь стену');
      }

      /* 4. Обнаружение не мгновенное: держим Наю в конусе и смотрим,
            сколько миллисекунд уходит до погони. */
      const detect = await page.evaluate(() => {
        const W = Stealth.W, C = Stealth.CFG;
        const fi = Stealth.floorOf(gameState.currentRoom);
        if (W.floor !== fi) W.moveFloor(fi);
        Stealth.grace = 0;
        W.state = 'PATROL'; W.see = 0; W.lose = 0; Stealth.alarm = 0; Stealth.hidden = null;
        Player.x = W.x + Math.cos(W.dir) * 18; Player.y = W.y + Math.sin(W.dir) * 18;
        let t = 0;
        while (t < 8000 && W.state !== 'CHASE') {
          Player.x = W.x + Math.cos(W.dir) * 18; Player.y = W.y + Math.sin(W.dir) * 18;
          Stealth.update(32); t += 32;
        }
        return { t, state:W.state, need:C.DETECT_TIME };
      });
      mark('обнаружение: ' + detect.t + ' мс, ' + detect.state);
      if (detect.state !== 'CHASE') fail(tag + 'так и не заметила Наю в упор за 8 секунд');
      if (detect.t < detect.need * 0.5) fail(tag + 'заметила мгновенно: ' + detect.t + ' мс');

      /* 5. Шум поднимает хозяйку с маршрута. */
      const noise = await page.evaluate(() => {
        Stealth.W.calm(); Stealth.alarm = 0; Stealth.noises = [];
        const before = Stealth.W.state;
        Stealth.noise(Stealth.W.x + 40, Stealth.W.y, 120, 1, 'prop');
        Stealth.update(32);
        return { before, after:Stealth.W.state, target:!!Stealth.W.target };
      });
      mark('шум проверен');
      if (noise.after === noise.before && noise.after === 'PATROL')
        fail(tag + 'шум рядом не изменил поведение');

      /* 6. Кристалл подсказывает только на своём этаже и только вблизи. */
      const hint = await page.evaluate(() => {
        const sp = Stealth.spot;
        const fx = FX.particles.length;
        // другой этаж — молчит
        const other = Stealth.def.floors.findIndex((k, i) => i !== sp.floor);
        const save = gameState.currentRoom;
        gameState.currentRoom = Stealth.def.floors[other];
        Player.x = sp.x; Player.y = sp.y;
        Stealth.crystalHint();
        const offFloor = (FX.particles.length) - fx;
        gameState.currentRoom = Stealth.def.floors[sp.floor];
        Player.x = sp.x + 400; Player.y = sp.y + 400;
        Stealth.crystalHint();
        const far = (FX.particles.length) - fx - offFloor;
        Player.x = sp.x; Player.y = sp.y;
        Stealth.crystalHint();
        const near = (FX.particles.length) - fx - offFloor - far;
        gameState.currentRoom = save;
        return { offFloor, far, near };
      });
      mark('кристалл проверен');
      if (hint.offFloor !== 0) fail(tag + 'кристалл отзывается через этаж');
      if (hint.far !== 0) fail(tag + 'кристалл отзывается издалека');
      if (hint.near <= 0) fail(tag + 'кристалл молчит на самом тайнике');

      /* 7. Сью: лимит, перезарядка, и хозяйка правда идёт на её зов. */
      mark('к проверке Сью');
      if (def.sue > 0) {
        const sue = await page.evaluate(() => {
          Stealth.SUE.reset(Stealth.def.sue);
          const r = { calls:[], moved:0 };
          for (let i = 0; i < Stealth.def.sue + 1; i++) {
            const wasFloor = Stealth.W.floor, wasT = Stealth.W.target;
            const ok = Stealth.SUE.call();
            r.calls.push(ok);
            if (ok) {
              const s = Stealth.def.sueSpots[(Stealth.SUE.spotIdx - 1) % Stealth.def.sueSpots.length];
              if (Stealth.W.floor === s.floor &&
                  Stealth.W.target && Math.hypot(Stealth.W.target.x - s.x, Stealth.W.target.y - s.y) < 2) r.moved++;
              Stealth.SUE.cool = 0; Stealth.SUE.busy = 0;   // проверяем лимит, не таймер
            }
          }
          // перезарядка
          Stealth.SUE.reset(2);
          const first = Stealth.SUE.call();
          const second = Stealth.SUE.call();
          return Object.assign(r, { first, second, left:Stealth.SUE.left });
        });
        const good = sue.calls.filter(Boolean).length;
        if (good !== def.sue) fail(tag + 'Сью отвлекает ' + good + ' раз вместо ' + def.sue);
        if (sue.calls[def.sue] !== false) fail(tag + 'Сью зовётся сверх лимита');
        if (sue.moved !== def.sue) fail(tag + 'зов Сью не уводит хозяйку: ' + sue.moved + '/' + def.sue);
        if (!sue.first || sue.second) fail(tag + 'перезарядка Сью не работает');
      } else {
        const solo = await page.evaluate(() =>
          ({ btn:document.getElementById('sueBtn').classList.contains('on'), call:Stealth.SUE.call() }));
        if (solo.btn) fail(tag + 'кнопка Сью показана в одиночной краже');
        if (solo.call) fail(tag + 'Сью отвлекает там, где её нет');
      }

      /* 7б. Укрытия. Точка укрытия может быть ВНУТРИ мебели — «забралась
             в шкаф» это буквально. Поэтому проверяется поведение: Ная
             прячется, выходит и оказывается на свободном месте, а не
             запертой в шкафу навсегда. */
      const укрытия = [];
      for (let fi = 0; fi < def.floors.length; fi++) {
        const bad = await page.evaluate(async ([MID, fi]) => {
          const M = Stealth.MISSIONS[MID], key = M.floors[fi], res = [];
          const wp = M.witch.routes[fi][0];
          if (gameState.currentRoom !== key) await changeRoom(key, wp.x, wp.y);
          const gr = Stealth.nav.grid(key);
          /* Здесь проверяется геометрия укрытий, а не хозяйка: рядом с ней
             выйти нельзя нарочно (это проверяется ниже), и если она стоит
             у лестницы, «Под лестницей» не выпустит — по делу. */
          const wasOn = Stealth.W.active;
          Stealth.W.active = false;
          for (const it of (Rooms[key].interactables || [])) {
            if (!it.hide) continue;
            let ok = false;
            for (let gy = Math.floor((it.y - 10) / gr.C); gy <= Math.floor((it.y + it.h + 10) / gr.C) && !ok; gy++)
              for (let gx = Math.floor((it.x - 10) / gr.C); gx <= Math.floor((it.x + it.w + 10) / gr.C) && !ok; gx++)
                if (Stealth.nav.free(gr, gx, gy)) { Player.x = gx * gr.C + 4; Player.y = gy * gr.C + 4; ok = true; }
            if (!ok) { res.push(`${key}: к укрытию «${it.prompt}» негде встать`); continue; }
            const bx = Player.x, by = Player.y;
            it.action();
            if (!Stealth.hidden) res.push(`${key}: «${it.prompt}» не прячет`);
            it.action();
            if (Stealth.hidden) res.push(`${key}: «${it.prompt}» не выпускает`);
            if (isBlocked(Player.x, Player.y))
              res.push(`${key}: после «${it.prompt}» Ная заперта в мебели`);
            if (Math.hypot(Player.x - bx, Player.y - by) > 40)
              res.push(`${key}: после «${it.prompt}» Наю отбросило далеко от укрытия`);
          }
          Stealth.W.active = wasOn;
          return res;
        }, [id, fi]);
        укрытия.push(...bad);
      }
      if (укрытия.length) fail(tag + укрытия.join('; '));
      mark('укрытия проверены');

      /* 8. Поимка: две — чекпоинт, третья — конец миссии. */
      const caught = await page.evaluate(async () => {
        Stealth.caught = 0; Stealth._caughtLock = false;
        const r = [];
        for (let i = 0; i < 3; i++) {
          Stealth.caughtNow();
          await new Promise(res => setTimeout(res, 1500));
          r.push({ n:Stealth.caught, on:Stealth.on, room:gameState.currentRoom });
        }
        return r;
      });
      mark('поимки проверены');
      if (!caught[0].on || !caught[1].on) fail(tag + 'миссия обрывается раньше третьей поимки');
      if (caught[2].on) fail(tag + 'три поимки не заканчивают миссию');

      out.push({ mission:id, spot:st0.spot, floors:def.floors.length, sue:def.sue,
                 detectMs:detect.t, wps:seen.wps.length, patrolFloor:patrol.floor });
      await page.evaluate(() => { Scene.abort(); if (Stealth.on) Stealth.finish(false); });
      await page.waitForTimeout(200);
    }
    return out;
  });
  res.forEach(r => console.log('  ' + JSON.stringify(r)));
  console.log('STEALTH: ок');
}

main().then(() => {
  if (H.errors.length) { H.errors.forEach(e => console.log('  ' + e)); process.exit(1); }
}).catch(e => { console.error(String(e.message || e)); process.exit(1); });
