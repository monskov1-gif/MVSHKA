/* Расстановка во всех комнатах: то, что видно сразу и портит вид.

   1. Настенное висит на стене. Картина, постер, окно, часы — у модели
      wall:true — обязаны лежать на стене целиком. Картина на тонкой
      перегородке или ниже карниза выглядит лежащей на полу.
   2. Настенное не висит на двери и на окне. Двери и окна чаще всего
      нарисованы в фоне, а не стоят предметами, поэтому тест при
      отрисовке фона перехватывает художников проёмов — uniWindow,
      uniWindowTurned, uniDoorInWall, paintDoor — и записывает их
      прямоугольники; у крыльев университета проёмы берутся из той же
      раскладки, по которой их рисует paintWing.
   3. Настенное не наезжает на настенное.
   4. Мебель не стоит в мебели: следы (foot) не пересекаются.

   Дом Мадлен собран по чертежу и проверяется tests/madplan.js, поэтому
   здесь пропускается. Осознанные исключения перечислены ниже с причиной. */
const H = require('./harness.js');

/* Настенное, которому стена не нужна, — по комнате и модели. */
const FREE_HANG = {
  uniTheatre: { stage_curtain:'кулисы висят в портале сцены, а не на стене' },
};

/* Мебель, которая ставится к стене. */
const AGAINST_WALL = ['wardrobe','bookshelf','cabinet','dresser','sideboard','fridge','stove','counter','sink',
  'vanity','tv_stand','piano','fireplace','jar_shelf','herb_shelf','metal_shelf','lockers','lockers_side',
  'display_case','card_catalog','mirror_tall','makeup_table','coat_rack','nightstand','bathtub','toilet',
  'bed_single','bed_double','library_shelf','cake_case','coffee_machine','bar_counter','radiator','altar'];

/* Проверка целиком живёт в странице: так её можно звать и из теста, и
   из отладочного скрипта для одной комнаты. */
const CHECK = ([FREE_HANG, AGAINST_WALL]) => {
  const WINGS = {
    uniWestHall:[UNI_W1_LEFT, UNI_W1_RIGHT], uniEastHall:[UNI_E1_LEFT, UNI_E1_RIGHT],
    uniWest2:[UNI_W2_LEFT, UNI_W2_RIGHT], uniEast2:[UNI_E2_LEFT, UNI_E2_RIGHT],
  };
  const rectOf = o => { const d = Art.meta(o.t); return d && { x:o.x - d.ax, y:o.y - d.ay, w:d.w, h:d.h }; };
  const inter = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    return x2 > x && y2 > y ? (x2 - x) * (y2 - y) : 0;
  };
  const out = {};
  /* Художники проёмов: подменяются на время отрисовки фона. */
  let rec = null;
  const wrap = (name, pick) => {
    const orig = window[name];
    window[name] = function () { if (rec) rec.push(Object.assign({ by:name }, pick.apply(null, arguments))); return orig.apply(this, arguments); };
  };
  wrap('uniWindow',       (g, x, y, w, h, o) => ({ x:x - 6, y:y - 6, w:w + 12, h:h + 8 + (o && o.arch ? h * .3 : 0) }));
  wrap('uniWindowTurned', (g, x, y, w, h) => ({ x:x - 6, y:y - 6, w:w + 12, h:h + 12 }));
  wrap('uniDoorInWall',   (g, x, y, w, h) => ({ x:x - 4, y:y - 16, w:w + 8, h:h + 16 }));
  wrap('paintDoor',       (g, x, y, w, h) => ({ x, y, w:w || 30, h:h || 15 }));

  for (const key of Object.keys(Rooms)) {
    const room = Rooms[key];
    if (room.madFloor !== undefined) continue;
    const bad = [];
    rec = [];
    try { gameState.currentRoom = key; World.invalidate(); World.background(key); } catch (e) { bad.push('фон: ' + e.message); }
    const open = rec; rec = null;
    if (WINGS[key]) WINGS[key].forEach((L, side) => L.items.forEach(it => {
      const x = side === 0 ? 0 : 198;
      open.push({ by:'wing', x, y:it.y - (it.k === 'door' ? 16 : 6), w:62, h:it.h + (it.k === 'door' ? 20 : 12) });
    }));
    const objs = (room.objects || []).filter(o => !o.when || o.when());
    const wallish = objs.filter(o => { const d = Art.meta(o.t); return d && d.wall; });
    const free = FREE_HANG[key] || {};
    wallish.forEach(o => {
      if (free[o.t]) return;
      const r = rectOf(o);
      /* 1. на стене: доля рисунка, лежащая на стенах комнаты */
      let n = 0, t = 0;
      for (let y = r.y + .5; y < r.y + r.h; y += 1) for (let x = r.x + .5; x < r.x + r.w; x += 1) {
        t++; if ((room.walls || []).some(w => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)) n++;
      }
      if (n / t < .9) bad.push(`${o.t} (${o.x},${o.y}) не на стене: на стене ${Math.round(n / t * 100)}%`);
      /* 2. не на проёме */
      open.forEach(q => {
        const s = inter(r, q);
        if (s > r.w * r.h * .12) bad.push(`${o.t} (${o.x},${o.y}) висит на ${q.by === 'uniDoorInWall' || q.by === 'paintDoor' || q.by === 'wing' ? 'проёме' : 'окне'} (${q.by} ${Math.round(q.x)},${Math.round(q.y)})`);
      });
    });
    /* 3. настенное на настенном */
    for (let i = 0; i < wallish.length; i++) for (let j = i + 1; j < wallish.length; j++) {
      const a = rectOf(wallish[i]), c = rectOf(wallish[j]);
      if (inter(a, c) > Math.min(a.w * a.h, c.w * c.h) * .12)
        bad.push(`${wallish[i].t} (${wallish[i].x},${wallish[i].y}) налезает на ${wallish[j].t} (${wallish[j].x},${wallish[j].y})`);
    }
    /* 4. следы мебели не пересекаются */
    const solid = objs.filter(o => Art.footOf(o));
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const s = inter(Art.footOf(solid[i]), Art.footOf(solid[j]));
      if (s > 4) bad.push(`${solid[i].t} (${solid[i].x},${solid[i].y}) стоит в ${solid[j].t} (${solid[j].x},${solid[j].y})`);
    }
    /* 5. мебель не загораживает дверь и не закрывает окно. Дверь —
          это и нарисованный проём, и зона перехода в другую комнату. */
    const doors = open.filter(q => q.by === 'uniDoorInWall' || q.by === 'paintDoor' || (q.by === 'wing' && q.h > 0));
    (room.interactables || []).forEach(z => {
      if (/changeRoom|climb|leave\(/.test(String(z.action || ''))) doors.push({ by:'zone', name:z.name, x:z.x, y:z.y, w:z.w, h:z.h });
    });
    objs.forEach(o => {
      const d = Art.meta(o.t); if (!d || d.flat || d.wall || !d.foot) return;
      if (/^(stairs_|bus_stop|hell_|castle_|house_|shop|chapel|garage|car)/.test(o.t)) return;   // сама архитектура
      const r = rectOf(o), f = Art.footOf(o);
      doors.forEach(q => {
        if (q.by === 'zone') { if (inter(f, q) > 0) bad.push(`${o.t} (${o.x},${o.y}) стоит в проходе «${q.name}»`); }
        else if (q.by !== 'wing' && inter(r, q) > q.w * q.h * .30) bad.push(`${o.t} (${o.x},${o.y}) стоит на двери (${q.by} ${Math.round(q.x)},${Math.round(q.y)})`);
      });
      open.filter(q => q.by === 'uniWindow').forEach(q => {
        if (inter(r, q) > q.w * q.h * .30) bad.push(`${o.t} (${o.x},${o.y}) закрывает окно (${Math.round(q.x)},${Math.round(q.y)})`);
      });
    });
    /* 6. пристенная мебель стоит у стены. Шкаф, комод, плита посреди
          комнаты — самая частая причина «мебель расставлена отдельно».
          Где отступ задуман (стеллажи библиотеки рядами, пианино на
          сцене), у предмета стоит free:true с объяснением рядом. */
    objs.forEach(o => {
      if (!AGAINST_WALL.includes(o.t) || o.free) return;
      /* Меряется рисунок: у мебели под дальней стеной след начинается
         ниже, а сама она касается стены верхом. */
      const f = rectOf(o);
      let best = 1e9;
      (room.walls || []).forEach(w => {
        const dx = Math.max(w.x - (f.x + f.w), 0, f.x - (w.x + w.w));
        const dy = Math.max(w.y - (f.y + f.h), 0, f.y - (w.y + w.h));
        best = Math.min(best, Math.hypot(dx, dy));
      });
      if (best > 6) bad.push(`${o.t} (${o.x},${o.y}) стоит посреди комнаты: до стены ${Math.round(best)} px`);
    });
    if (bad.length) out[key] = bad;
  }
  return out;
};

async function main() {
  const res = await H.run('DECOR', async page => {
    await H.newGame(page);
    return page.evaluate(CHECK, [FREE_HANG, AGAINST_WALL]);
  });
  const rooms = Object.keys(res);
  rooms.forEach(k => { console.log('✗ ' + k); res[k].forEach(m => console.log('    ' + m)); });
  if (H.errors.length) { console.log('\nОшибки страницы:'); H.errors.forEach(e => console.log('  ! ' + e)); }
  if (rooms.length || H.errors.length) {
    console.log(`\nПРОВАЛ: ${rooms.reduce((a, k) => a + res[k].length, 0)} нарушений в ${rooms.length} комнатах`);
    process.exit(1);
  }
  console.log('OK: настенное на стенах и не на проёмах, мебель не стоит в мебели');
}
module.exports = { CHECK, FREE_HANG, AGAINST_WALL };
if (require.main === module) main().catch(e => { console.error(String(e.stack || e)); process.exit(1); });
