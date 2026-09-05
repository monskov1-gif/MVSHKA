const H = require('./harness.js');
(async () => {
  await H.run('CAMPUS', async page => {
    await H.newGame(page);
    await page.evaluate(() => {
      Dialogue.active=false; Scene.active=false; Game.mode='explore';
      document.getElementById('dialogueBox').classList.remove('active');
      document.getElementById('fade').classList.remove('show');
      ['metSue','cafeSceneComplete','waitingAtAud','mainStoryStarted','metGenevieveUni'].forEach(f=>gameState.flags[f]=true);
      gameState.currentRoom='uniCorridorLib'; Player.x=300; Player.y=260; unstickPlayer(); World.invalidate();
    });
    for (let i=1;i<=4;i++) {
      await page.evaluate(()=>{ Campus.noticed(); });
      await page.waitForTimeout(700);
      const st = await H.snap(page);
      console.log(i, 'heat=%s комната=%s', await page.evaluate(()=>gameState.counters.campusHeat), st.room);
    }
    await H.pump(page, [0], 'CAMPUS');
    let s = await H.snap(page);
    console.log('после высылки: комната=%s restricted=%s route=%s',
      s.room, s.flags.includes('universityAccessRestricted'), s.flags.includes('universityWindowRouteUnlocked'));
    // автобус закрыт
    console.log(await H.useObj(page, 'toUni'));
    await H.pump(page, [], 'CAMPUS');
    s = await H.snap(page);
    console.log('после попытки автобусом: комната=%s', s.room);
    // обходной путь
    console.log(await H.useObj(page, 'uniBackYard'));
    await H.pump(page, [], 'CAMPUS');
    s = await H.snap(page);
    console.log('после обхода: комната=%s oldWingOpen=%s', s.room, s.flags.includes('oldWingOpen'));
    return {};
  });
  H.errors.forEach(e=>console.log(e));
  console.log(H.errors.length ? 'ЕСТЬ ОШИБКИ' : 'без ошибок');
})();
