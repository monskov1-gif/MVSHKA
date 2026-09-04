/* Проверка, что во время пролога на экране не появляется взрослая Ная. */
const H = require('./harness.js');

(async () => {
  const out = await H.run('PROLOGUE', async page => {
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload(); await page.waitForTimeout(400);
    await page.click('#btnNew'); await page.waitForTimeout(300);

    // пока идёт пролог — раз в 120 мс смотрим, кем сейчас нарисован игрок
    await page.evaluate(() => {
      window.__probe = [];
      window.__t = setInterval(() => {
        // gameState объявлен через let, поэтому на window его нет — берём по имени
        if (typeof gameState === 'undefined' || !gameState) return;
        const room = Rooms[gameState.currentRoom];
        window.__probe.push({
          room: gameState.currentRoom,
          drawn: !room.cinematic,             // игрок рисуется только вне кат-сцен
          sprite: Player.currentSprite(),
        });
      }, 120);
    });

    // прогоняем пролог: адская нарратива, карточка главы, площадка
    await H.pump(page, [], 'prologue');
    const shot1 = await page.evaluate(() => ({ room: gameState.currentRoom, sprite: Player.currentSprite() }));
    await H.step(page, 'obj', 'swing', [], 'PROLOGUE');       // первая магия -> глава 1
    await page.evaluate(() => clearInterval(window.__t));

    const probe = await page.evaluate(() => window.__probe);
    const after = await H.snap(page);
    return { probe, shot1, after };
  });

  const { probe, shot1, after } = out;
  const seen = {};
  probe.forEach(p => { const k = p.room + '|' + (p.drawn ? 'виден' : 'скрыт') + '|' + p.sprite; seen[k] = (seen[k]||0)+1; });
  console.log('кадры пролога (комната | игрок | спрайт):');
  Object.entries(seen).forEach(([k, n]) => console.log('  ' + k.padEnd(42) + n));

  if (!probe.length) { console.log('\nПРОВАЛ: замер не собрал ни одного кадра'); process.exit(1); }
  const bad = probe.filter(p => p.drawn && p.sprite !== 'sueChild' && !p.room.startsWith('naya'));
  console.log('\nперед качелями: room=%s sprite=%s', shot1.room, shot1.sprite);
  console.log('после пролога:  room=%s prologueComplete=%s', after.room, after.flags.includes('prologueComplete'));

  if (bad.length) {
    console.log('\nПРОВАЛ: взрослая модель видна в ' + bad.length + ' кадрах, например ' +
      JSON.stringify(bad[0]));
    process.exit(1);
  }
  if (H.errors.length) { console.log('\nОШИБКИ:'); H.errors.forEach(e => console.log(' ', e)); process.exit(1); }
  console.log('\nOK: взрослая Ная в прологе на экране не появляется');
})().catch(e => { console.log('FAIL:', e.message); process.exit(1); });
