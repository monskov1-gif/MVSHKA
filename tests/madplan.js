/* Дом Мадлен против эталонного чертежа.

   Тест ничего не описывает словами: он запускает проверку, встроенную в
   игру, и падает на её ошибках. Считаются две вещи — геометрия
   (пообъектные отклонения от снятых с чертежа координат, с допусками по
   типам) и пиксели (структурные растры эталона и реализации, слой за
   слоем). Плюс проверки планировки: мебель в стене, мебель в проёме,
   окно за шкафом, пересечение стен, перекрытая лестница, недостижимая
   зона, наложение коллизий и совпадение марша по вертикали.

   Запуск:  node tests/madplan.js            — отчёт и код возврата
            node tests/madplan.js --verbose  — плюс все отклонения       */
const H = require('./harness.js');
const VERBOSE = process.argv.includes('--verbose');

async function main() {
  const res = await H.run('MADPLAN', async page => {
    await H.newGame(page);
    return page.evaluate(() => {
      const out = { rep:MadPlan.validate({ log:false }), floors:[] };
      MADELEINE_HOUSE_PLAN.floors.forEach((f, i) => {
        const px = {};
        ['walls', 'doors', 'windows', 'stairs', 'furniture', 'all'].forEach(l => {
          const c = MadPlan.compareReferenceToRender(i, l);
          const k = MadPlan.compareReferenceToRender(i, l, { skipNoted:true });
          px[l] = { sim:+(100 * c.similarity).toFixed(1), net:+(100 * k.similarity).toFixed(1),
                    only1:c.only1, only2:c.only2 };
        });
        const d = MadPlan.deltas(i);
        out.floors.push({
          id:f.id, px,
          n:d.length, off:d.filter(x => !x.ok).length,
          blind:d.filter(x => !x.ok && !x.note).map(x => x.id + ' Δ' + x.err + ' px при допуске ±' + x.tol),
          worst:d.slice().sort((a, b) => b.err - a.err).slice(0, 6)
                 .map(x => x.id + ' ΔX' + x.dx + ' ΔY' + x.dy + ' ΔW' + x.dw + ' ΔH' + x.dh +
                           ' (±' + x.tol + ')' + (x.ok ? '' : '  ВНЕ ДОПУСКА')),
          bad:MadPlan.validateFloorplan(i).map(b => '[' + b.code + '] ' + b.msg),
          // сколько пола реально достижимо ногами от точки входа
          reach:MadPlan.reach(i).size,
        });
      });
      out.stairs = MadPlan.validateStairs().map(b => '[' + b.code + '] ' + b.msg);
      // отдельная проверка: у каждой комнаты геометрия та же, что в плане
      out.wired = MADELEINE_HOUSE_PLAN.floors.every((f, i) => {
        const r = Rooms[f.id];
        return r && r.w === MADELEINE_HOUSE_PLAN.shell.w &&
               r.h === MADELEINE_HOUSE_PLAN.shell.h &&
               r.walls.length === MadPlan.walls(i).length &&
               r.objects.length === f.furniture.length;
      });
      return out;
    });
  });

  console.log(res.rep.text);
  let bad = 0;
  res.floors.forEach(f => {
    console.log('');
    console.log('--- ' + f.id + ' ---');
    Object.keys(f.px).forEach(l =>
      console.log('  пиксели ' + l.padEnd(10) + f.px[l].sim + '%  (без разобранных ' +
                  f.px[l].net + '%; эталон-только ' + f.px[l].only1 +
                  ', игра-только ' + f.px[l].only2 + ')'));
    console.log('  объектов ' + f.n + ', вне допуска ' + f.off + ' (без объяснения ' +
                f.blind.length + '), достижимо клеток ' + f.reach);
    if (VERBOSE || f.off) f.worst.forEach(w => console.log('    ' + w));
    f.bad.forEach(b => { console.log('  ПРОВАЛ ' + b); bad++; });
    /* Гейт стоит на цифре без разобранных расхождений: сам чертёж кое-где
       спорит с собой, и эти места разобраны поимённо в поле note. Всё
       остальное обязано совпадать. */
    f.blind.forEach(b => { console.log('  ПРОВАЛ: необъяснённое отклонение ' + b); bad++; });
    if (f.px.walls.net < 99) { console.log('  ПРОВАЛ: стены совпали на ' + f.px.walls.net + '%'); bad++; }
    if (f.px.all.net < 95) { console.log('  ПРОВАЛ: план в целом совпал на ' + f.px.all.net + '%'); bad++; }
    if (f.reach < 400) { console.log('  ПРОВАЛ: проходимого пола почти нет (' + f.reach + ')'); bad++; }
  });
  res.stairs.forEach(b => { console.log('ПРОВАЛ ' + b); bad++; });
  if (!res.wired) { console.log('ПРОВАЛ: комната собрана не из плана'); bad++; }
  if (H.errors.length) { console.log('ОШИБКИ:'); H.errors.forEach(e => console.log('  ' + e)); bad++; }
  console.log('');
  console.log(bad ? 'ПЛАН ДОМА: ПРОВАЛ (' + bad + ')' : 'ПЛАН ДОМА: сверка пройдена');
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(String(e.message || e)); process.exit(1); });
