const H = require('./harness.js');
const card = async page => { await page.waitForSelector('#endingScreen.show', {timeout:15000}); return page.evaluate(() => ({
  shown: document.getElementById('endingScreen').classList.contains('show'),
  roman: document.getElementById('endingRoman').textContent,
  name: document.getElementById('endingName').textContent,
  body: document.getElementById('endingBody').textContent.slice(0,60),
  rows: [...document.querySelectorAll('#endingStats .statRow')].map(r=>r.textContent),
})); };

const warm = { cafe:0, home:0, lilith:2, gen:0, reveal:0 };

async function endingIII() {
  return H.run('III', async page => {
    await H.newGame(page);
    await H.opening(page, { cafe:1, home:1, lilith:0, gen:1, reveal:1 }, 'III');
    // pushy persuasion
    await H.step(page,'npc','Сью',[0],'III');
    await H.step(page,'npc','Сью',[2],'III');
    await H.step(page,'npc','Сью',[0],'III');
    let s = await H.snap(page);
    if (!s.flags.includes('sueAgreed')) throw new Error('III: expected sueAgreed, trust='+s.stats.trustSue);
    await H.amuletArc(page, { amulet1:1, amulet2:1 }, 'III');
    await H.step(page,'npc','Сью',[0],'III');    // revive
    await H.step(page,'npc','Сью',[],'III');
    await H.step(page,'npc','Сью',[2],'III');    // regret: "same again"
    await H.step(page,'npc','Сью',[],'III');
    await H.step(page,'npc','Сью',[0],'III');    // witch path
    s = await H.snap(page);
    return { card: await card(page), witch: s.flags.includes('chosenWitchPath'), stats: s.stats };
  });
}
async function endingII() {
  return H.run('II', async page => {
    await H.newGame(page);
    await H.opening(page, { cafe:1, home:2, lilith:0, gen:1, reveal:1 }, 'II');
    await H.step(page,'npc','Сью',[0],'II');
    await H.step(page,'npc','Сью',[2],'II');
    await H.step(page,'npc','Сью',[2],'II');
    let s = await H.snap(page);
    if (!s.flags.includes('sueAgreed')) throw new Error('II: expected sueAgreed');
    await H.amuletArc(page, { amulet1:1, amulet2:2 }, 'II');
    await H.step(page,'npc','Сью',[1],'II');      // не возрождать -> ветка «Ная выбрала силу»
    s = await H.snap(page);
    if (!s.flags.includes('sueLeftDead')) throw new Error('II: expected sueLeftDead');
    if (s.room !== 'forestEdge') throw new Error('II: expected forestEdge, got ' + s.room);
    // 1. ночная лесная окраина
    await H.step(page,'obj','branch',[],'II');
    await H.step(page,'obj','ritual',[],'II');
    await H.step(page,'obj','crystal',[],'II');
    await H.step(page,'obj','leave',[],'II');     // -> пустой дом
    s = await H.snap(page);
    if (s.room !== 'nayaRoom') throw new Error('II: expected nayaRoom, got ' + s.room);
    // 2. осмотр пустого дома -> первый перелом
    await H.step(page,'obj','bedSue',[],'II');
    await H.step(page,'obj','mirror',[],'II');
    await H.step(page,'obj','lowTable',[],'II');
    await H.step(page,'obj','table',[],'II');     // четвёртый -> evilFirstBreak
    s = await H.snap(page);
    if (!s.flags.includes('evilHomeDone')) throw new Error('II: first break did not fire');
    // 3. дорога к коммуне
    await H.step(page,'obj','door',[],'II');      // -> communeRoad
    await H.step(page,'obj','stone',[],'II');
    await H.step(page,'obj','onward',[],'II');    // -> communeYard
    await H.step(page,'obj','inside',[],'II');    // -> communeHall
    await H.step(page,'npc','Старшая',[],'II');   // испытание предложено
    s = await H.snap(page);
    if (!s.flags.includes('evilTrialOffered')) throw new Error('II: trial was not offered');
    // 4. испытание
    await H.step(page,'obj','toTrial',[],'II');   // -> trialRoom (+ intro)
    await H.step(page,'obj','altar',[1],'II');    // забрать силу
    s = await H.snap(page);
    if (!s.flags.includes('evilTrialDone')) throw new Error('II: trial did not resolve');
    await H.step(page,'obj','exit',[],'II');      // -> communeHall
    // 5. монтаж, ад, признание
    await H.step(page,'npc','Старшая',[],'II');
    s = await H.snap(page);
    if (!s.flags.includes('evilRecognised')) throw new Error('II: not recognised, room=' + s.room);
    if (s.room !== 'hellStreet') throw new Error('II: expected hellStreet, got ' + s.room);
    // 6. адская площадь и финал
    await H.step(page,'npc','Житель',[],'II');
    await H.step(page,'obj','greatPortal',[],'II');
    s = await H.snap(page);
    console.log('  II: humanity=%s witch=%s hell=%s', s.stats.humanity, s.stats.witchAmbition, s.stats.hellAffinity);
    return { card: await card(page), left: s.flags.includes('sueLeftDead'), stats: s.stats };
  });
}
async function endingI() {
  return H.run('I', async page => {
    await H.newGame(page);
    await H.opening(page, { cafe:2, home:2, lilith:0, gen:1, reveal:1 }, 'I');
    let s = await H.snap(page);
    console.log('  I: trust before persuasion =', s.stats.trustSue);
    await H.step(page,'npc','Сью',[3],'I');      // respect
    await H.step(page,'npc','Сью',[3],'I');      // "I don't know"
    await H.step(page,'npc','Сью',[3],'I');      // silence
    s = await H.snap(page);
    console.log('  I: refused=%s trust=%s', s.flags.includes('sueRefused'), s.stats.trustSue);
    if (!s.flags.includes('sueRefused')) throw new Error('I: expected sueRefused, trust='+s.stats.trustSue);
    await H.step(page,'obj','door',[],'I');
    await H.step(page,'obj','toStairs',[],'I');
    await H.step(page,'obj','toStreet',[],'I');
    await H.step(page,'obj','toRightHouse',[],'I');
    await H.step(page,'npc','Женевьева',[],'I');   // lonerGenevieve
    await H.step(page,'obj','exit',[],'I');
    await H.step(page,'obj','toLeftHouse',[],'I'); // lonerDoor
    await H.step(page,'obj','toAlley',[],'I');
    await H.step(page,'obj','window',[],'I');      // break-in
    await H.step(page,'obj','exit',[],'I');
    await H.step(page,'obj','toRightHouse',[],'I');
    await H.step(page,'obj','toCommune',[],'I');   // discovered -> chase
    const chase = await page.evaluate(()=>({active: !!(Game.chase&&Game.chase.active), room:gameState.currentRoom}));
    console.log('  I: chase =', JSON.stringify(chase));
    if (!chase.active) throw new Error('I: chase did not start');
    // погоня стартует в парке: парк -> Мейпл-стрит -> дом
    await H.step(page,'obj','toStreet',[],'I');
    await H.step(page,'obj','toHome',[],'I');      // escape -> caught scene -> ending I
    s = await H.snap(page);
    return { card: await card(page), caught: s.flags.includes('lonerCaught'),
             crystal: s.flags.includes('crystalTaken'), escaped: s.flags.includes('lonerEscaped'), stats: s.stats };
  });
}

async function endingIV() {

  return await H.run('ENDING-IV', async page => {
    await H.newGame(page);
    // warm, honest playthrough
    const picks = { cafe:0, home:0, lilith:2, gen:0, reveal:0 };
    await H.opening(page, picks, 'IV');
    let s = await H.snap(page);
    console.log('after opening: room=%s act=%s trust=%s flags=%s', s.room, s.act, s.stats.trustSue, s.flags.join(','));
    // choice 1: honest / honest / no
    await H.step(page, 'npc', 'Сью', [1], 'IV');
    await H.step(page, 'npc', 'Сью', [0], 'IV');
    await H.step(page, 'npc', 'Сью', [1], 'IV');
    s = await H.snap(page);
    console.log('after persuasion: sueAgreed=%s trust=%s', s.flags.includes('sueAgreed'), s.stats.trustSue);
    if (!s.flags.includes('sueAgreed')) throw new Error('expected sueAgreed');
    await H.amuletArc(page, { amulet1:0, amulet2:0 }, 'IV');
    s = await H.snap(page);
    console.log('after third amulet: inv=%s sueDead=%s', s.inv.join('|'), s.flags.includes('sueDead'));
    await H.step(page, 'npc', 'Сью', [0], 'IV');          // revive
    s = await H.snap(page);
    console.log('revived=%s trust=%s', s.flags.includes('sueRevived'), s.stats.trustSue);
    await H.step(page, 'npc', 'Сью', [], 'IV');           // silence
    await H.step(page, 'npc', 'Сью', [0], 'IV');          // regret
    await H.step(page, 'npc', 'Сью', [], 'IV');           // fear
    const end = await H.step(page, 'npc', 'Сью', [2], 'IV'); // reflection -> give crystal -> ending IV
    s = await H.snap(page);
    await page.waitForSelector('#endingScreen.show', {timeout:15000});
    const card = await page.evaluate(() => ({
      shown: document.getElementById('endingScreen').classList.contains('show'),
      name: document.getElementById('endingName').textContent,
      roman: document.getElementById('endingRoman').textContent,
      meta: JSON.parse(localStorage.getItem('revenge_of_witch_meta_v2') || '{}'),
      rewind: document.getElementById('btnRewind').style.display,
    }));
    return { end, card, mem: s.mem, gave: s.flags.includes('gaveCrystalAway') };
  });

}

(async () => {
  const results = [];
  const only = process.argv.slice(2).map(function (a) { return a.toUpperCase(); });
  const all = [['I', endingI], ['II', endingII], ['III', endingIII], ['IV', endingIV]];
  for (const [n, f] of (only.length ? all.filter(function (p) { return only.includes(p[0]); }) : all)) {
    try {
      const r = await f();
      const label = r && r.card ? r.card.roman + ' ' + r.card.name : '';
      results.push([n, 'OK', label]);
      console.log('=== ' + n + ' OK: ' + label);
    } catch (e) {
      results.push([n, 'FAIL', e.message]);
      console.log('=== ' + n + ' FAIL: ' + e.message);
    }
  }
  console.log('\nSUMMARY');
  results.forEach(function (r) { console.log('  ' + r[0].padEnd(4) + ' ' + r[1].padEnd(5) + ' ' + r[2]); });
  if (H.errors.length) { console.log('\nERRORS:'); H.errors.forEach(function (e) { console.log(' ', e); }); }
  else { console.log('\nno console/page errors'); }
  process.exit(results.some(function (r) { return r[1] === 'FAIL'; }) ? 1 : 0);
})();
