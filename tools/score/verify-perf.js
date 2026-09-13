/* Сверка тем-исполнений с исходным MIDI.

   Точные темы (Шопен) сверяются по времени, высоте и силе нажатия.
   Огранённые (Глиэр: педаль, динамика, микросдвиги) — по
   последовательности высот и по тому, что сдвиг каждой ноты остался в
   объявленных пределах. Высоты не меняет ни один флаг огранки, поэтому
   расхождение в них означает ошибку переноса.                          */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const SCRATCH = '/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad';

const JOBS = [
  { key:'hell',     src:'chopin.json', first:5,  last:20, beats:4, exact:true },
  { key:'sad',      src:'chopin.json', first:45, last:60, beats:4, exact:true },
  { key:'uni',      src:'gliere.json', first:1,  last:12, beats:6, exact:false, slack:0.06 },
];

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('file:///home/user/MVSHKA/index.html');
  await p.waitForFunction(() => typeof Music !== 'undefined');
  let bad = 0;
  for (const job of JOBS) {
    const m = JSON.parse(fs.readFileSync(SCRATCH + '/' + job.src, 'utf8'));
    const div = m.div, span = job.beats * div;
    const want = m.notes
      .filter(n => n.t >= (job.first-1)*span && n.t < job.last*span)
      .sort((a, c) => a.t - c.t || a.n - c.n)
      .map(n => [Math.round(((n.t - (job.first-1)*span)/div)*1000)/1000, n.n, n.v]);
    const got = await p.evaluate(k => {
      const tr = Music.TRACKS[k];
      return { n: tr.perf.map(x => [x[0], x[1], x[3]]), loop: tr.loopBeats, bpm: tr.bpm };
    }, job.key);

    let diff = 0;
    if (got.n.length !== want.length) { console.log(job.key, 'РАЗНОЕ ЧИСЛО НОТ', got.n.length, '≠', want.length); diff++; }
    /* Огранка двигает ноты во времени, поэтому сравниваем не по месту в
       списке, а по высоте: последовательность высот обязана совпасть. */
    const gp = got.n.map(x => x[1]).join(','), wp = want.map(x => x[1]).join(',');
    if (job.exact) {
      for (let i = 0; i < Math.min(got.n.length, want.length); i++) {
        const g = got.n[i], w = want[i];
        if (Math.abs(g[0]-w[0]) > 0.002 || g[1] !== w[1] || g[2] !== w[2]) {
          if (diff < 5) console.log(job.key, 'расхождение', i, JSON.stringify(g), '≠', JSON.stringify(w));
          diff++;
        }
      }
    } else {
      if (gp !== wp) { console.log(job.key, 'ПОСЛЕДОВАТЕЛЬНОСТЬ ВЫСОТ РАЗОШЛАСЬ'); diff++; }
      for (let i = 0; i < Math.min(got.n.length, want.length); i++) {
        const d = Math.abs(got.n[i][0] - want[i][0]);
        if (d > job.slack) {
          if (diff < 5) console.log(job.key, 'нота', i, 'сдвинута на', d.toFixed(3), '— больше допуска', job.slack);
          diff++;
        }
      }
    }
    console.log(job.key.padEnd(9), 'нот', String(got.n.length).padStart(4),
      '· петля', got.loop, 'долей ·', got.bpm, 'bpm ·',
      job.exact ? 'точный перенос' : 'с огранкой',
      '· расхождений:', diff);
    bad += diff;
  }
  await b.close();
  console.log(bad ? '\nПРОВАЛ' : '\nOK: все темы-исполнения совпадают с исходниками');
  process.exit(bad ? 1 : 0);
})();
