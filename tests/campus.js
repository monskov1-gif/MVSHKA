const H = require('./harness.js');
(async () => {
  await H.run('CAMPUS', async page => {
    await H.newGame(page);
    await page.evaluate(() => {
      Dialogue.active=false; Scene.active=false; Game.mode='explore';
      document.getElementById('dialogueBox').classList.remove('active');
      document.getElementById('fade').classList.remove('show');
      ['metSue','cafeSceneComplete','mainStoryStarted','metGenevieveUni'].forEach(f=>gameState.flags[f]=true);
      gameState.currentRoom='uniEastHall'; Player.x=130; Player.y=400; unstickPlayer(); World.invalidate();
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
    // обходной путь: улица -> задний двор -> окно -> служебный коридор в цоколе
    console.log(await H.useObj(page, 'uniBackYard'));
    await H.pump(page, [], 'CAMPUS');
    s = await H.snap(page);
    console.log('задний двор: комната=%s', s.room);
    if (s.room !== 'uniBackYard') throw new Error('ожидался uniBackYard, а не ' + s.room);
    console.log(await H.useObj(page, 'window'));
    await H.pump(page, [], 'CAMPUS');
    s = await H.snap(page);
    console.log('после окна: комната=%s oldWingOpen=%s', s.room, s.flags.includes('oldWingOpen'));
    if (s.room !== 'uniServiceStair') throw new Error('ожидалась uniServiceStair, а не ' + s.room);
    /* Обход должен доводить не до лестницы, а внутрь корпуса: лестница —
       только вход. Проверяем весь путь до главного холла. */
    for (const [name, want] of [['toOldWing','uniOldWing'], ['toCorr2','uniCorr2'], ['toFloor1','uniHall']]) {
      const r = await H.useObj(page, name);
      if (r !== 'ok') throw new Error(name + ': ' + r);
      await H.pump(page, [], 'CAMPUS');
      s = await H.snap(page);
      console.log('%s -> %s', name, s.room);
      if (s.room !== want) throw new Error('ожидался ' + want + ', а не ' + s.room);
    }
    return {};
  });
  H.errors.forEach(e=>console.log(e));
  console.log(H.errors.length ? 'ЕСТЬ ОШИБКИ' : 'без ошибок');
})();
