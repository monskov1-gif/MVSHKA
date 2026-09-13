const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs=require('fs');
(async () => {
  const m = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad/chopin.json','utf8'));
  const div = m.div;
  const want = (first, last) => m.notes
    .filter(n => n.t >= (first-1)*4*div && n.t < last*4*div)
    .sort((a,b)=> a.t-b.t || a.n-b.n)
    .map(n => [Math.round(((n.t-(first-1)*4*div)/div)*1000)/1000, n.n, n.v]);
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('file:///home/user/MVSHKA/index.html');
  await p.waitForFunction(()=>typeof Music!=='undefined');
  let bad = 0;
  for (const [key, first, last] of [['hell',5,20],['prologue',45,60]]) {
    const got = await p.evaluate(k => {
      const tr = Music.TRACKS[k];
      return { n: tr.perf.map(x=>[x[0], x[1], x[3]]), loop: tr.loopBeats, bpm: tr.bpm };
    }, key);
    const w = want(first, last);
    let diff = 0;
    if (got.n.length !== w.length) { console.log(key, 'РАЗНОЕ ЧИСЛО НОТ', got.n.length, '≠', w.length); diff++; }
    for (let i=0;i<Math.min(got.n.length,w.length);i++) {
      const g=got.n[i], x=w[i];
      if (Math.abs(g[0]-x[0])>0.002 || g[1]!==x[1] || g[2]!==x[2]) {
        if (diff<5) console.log(key,'расхождение',i,JSON.stringify(g),'≠',JSON.stringify(x));
        diff++;
      }
    }
    console.log(key.padEnd(9), 'нот', String(got.n.length).padStart(4),
      '· петля', got.loop, 'долей ·', got.bpm, 'bpm · расхождений с MIDI:', diff);
    bad += diff;
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
