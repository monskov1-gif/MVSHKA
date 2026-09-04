/* Быстрый прогон только ветки «Ная выбрала силу» (концовка II). */
const H = require('./harness.js');

(async () => {
  const out = await H.run('EVIL', async page => {
    await H.newGame(page);
    // прыгаем сразу к моменту после смерти Сью: ветка начинается здесь
    await page.evaluate(() => {
      const f = gameState.flags;
      ['prologueComplete','prologPlayground','mainStoryStarted','metSue','cafeSceneComplete',
       'metGenevieveUni','investigatedUniversity','learnedMedea','learnedWitches','homeTalkDone',
       'portalOpened','metCharlotte','metLilith','returnedFromHell1','toldSueWitch','foundGenevieve',
       'communeIntro','persuasionDone','sueAgreed','firstAmulet','firstWitchDead','communePanic',
       'secondAmulet','communeWarded','thirdHouseOpen','thirdAmulet','sueDead'].forEach(k => f[k] = true);
      gameState.act = 4;
      gameState.inventory = ['Кристалл','Амулет I','Амулет II','Амулет III'];
      gameState.currentRoom = 'nayaRoom';
      Player.x = 120; Player.y = 250;
      World.invalidate();
    });
    await page.waitForTimeout(300);
    const log = [];
    const mark = async (tag) => { const s = await H.snap(page); log.push(tag + ': room=' + s.room); return s; };

    await H.step(page,'npc','Сью',[1],'EVIL');      // reviveChoice -> не возрождать
    let s = await mark('после выбора');
    if (s.room !== 'forestEdge') throw new Error('ожидался forestEdge, а не ' + s.room);
    await H.step(page,'obj','branch',[],'EVIL');
    await H.step(page,'obj','ritual',[],'EVIL');
    await H.step(page,'obj','crystal',[],'EVIL');
    await H.step(page,'obj','leave',[],'EVIL');
    s = await mark('дома');
    if (s.room !== 'nayaRoom') throw new Error('ожидался nayaRoom, а не ' + s.room);
    await H.step(page,'obj','bedSue',[],'EVIL');
    await H.step(page,'obj','mirror',[],'EVIL');
    await H.step(page,'obj','lowTable',[],'EVIL');
    await H.step(page,'obj','table',[],'EVIL');
    s = await mark('после перелома');
    if (!s.flags.includes('evilHomeDone')) throw new Error('перелом не сработал');
    await H.step(page,'obj','door',[],'EVIL');
    s = await mark('дорога');
    await H.step(page,'obj','stone',[],'EVIL');
    await H.step(page,'obj','onward',[],'EVIL');
    await H.step(page,'obj','inside',[],'EVIL');
    s = await mark('коммуна');
    await H.step(page,'npc','Старшая',[],'EVIL');
    s = await mark('после Старшей');
    if (!s.flags.includes('evilTrialOffered')) throw new Error('испытание не предложено');
    await H.step(page,'obj','toTrial',[],'EVIL');
    s = await mark('комната испытания');
    await H.step(page,'obj','altar',[1],'EVIL');
    s = await mark('после испытания');
    if (!s.flags.includes('evilTrialDone')) throw new Error('испытание не пройдено');
    await H.step(page,'obj','exit',[],'EVIL');
    await H.step(page,'npc','Старшая',[],'EVIL');
    s = await mark('после монтажа');
    if (!s.flags.includes('evilRecognised')) throw new Error('признания не было, room=' + s.room);
    await H.step(page,'npc','Житель',[],'EVIL');
    await H.step(page,'obj','greatPortal',[],'EVIL');
    await page.waitForSelector('#endingScreen.show', {timeout:20000});
    const card = await page.evaluate(() => ({
      roman: document.getElementById('endingRoman').textContent,
      name: document.getElementById('endingName').textContent,
      sub: document.getElementById('endingSub').textContent,
      body: document.getElementById('endingBody').textContent,
      rows: [...document.querySelectorAll('#endingStats .statRow')].map(r=>r.textContent),
    }));
    s = await H.snap(page);
    return { log, card, stats: s.stats, mem: s.mem };
  });
  out.log.forEach(l => console.log('  ' + l));
  console.log('карточка:', out.card.roman, out.card.name);
  console.log('  ' + out.card.sub);
  console.log('  ' + out.card.body.replace(/\n/g, ' / '));
  console.log('  ' + out.card.rows.join('  '));
  console.log('воспоминаний:', out.mem);
  if (H.errors.length) { console.log('\nОШИБКИ:'); H.errors.forEach(e => console.log(' ', e)); process.exit(1); }
  console.log('\nбез ошибок');
})().catch(e => { console.log('FAIL:', e.message); if (H.errors.length) H.errors.forEach(x=>console.log(' ',x)); process.exit(1); });
