const H = require('./harness.js');
(async () => {
  await H.run('PERSIST', async page => {
    await H.newGame(page);
    await H.opening(page, { cafe:0, home:0, lilith:2, gen:0, reveal:0 }, 'P');
    const before = await H.snap(page);
    console.log('before reload: room=%s flags=%d trust=%s mem=%d',
      before.room, before.flags.length, before.stats.trustSue, before.mem);

    // simulate closing the browser
    await page.reload(); await page.waitForTimeout(500);
    const cont = await page.evaluate(()=>!document.getElementById('btnContinue').disabled);
    console.log('continue enabled after reload:', cont);
    await page.click('#btnContinue'); await page.waitForTimeout(900);
    const after = await H.snap(page);
    const same = JSON.stringify(before.flags.sort()) === JSON.stringify(after.flags.sort())
              && before.stats.trustSue === after.stats.trustSue
              && before.room === after.room;
    console.log('after reload:  room=%s flags=%d trust=%s mem=%d -> identical=%s',
      after.room, after.flags.length, after.stats.trustSue, after.mem, same);
    if (!same) throw new Error('save/load lost state');

    // the NPC that drives the next beat must still be present (this is what the old build lost)
    const npcs = await page.evaluate(()=>roomNPCs(Rooms[gameState.currentRoom]).map(n=>n.name));
    console.log('npcs present after load:', JSON.stringify(npcs));
    if (!npcs.includes('Сью')) throw new Error('Sue missing after reload — progression would dead-end');

    // checkpoint + rewind
    await H.step(page,'npc','Сью',[0],'P');
    await H.step(page,'npc','Сью',[2],'P');
    await H.step(page,'npc','Сью',[0],'P');
    const agreed = await H.snap(page);
    console.log('persuasion resolved: sueAgreed=%s cp=%s',
      agreed.flags.includes('sueAgreed'),
      await page.evaluate(()=>{ const c=JSON.parse(localStorage.getItem('revenge_of_witch_checkpoint_v2')||'null'); return c&&c.label; }));

    await page.evaluate(()=>rewindToCheckpoint());
    await page.waitForTimeout(900);
    const rew = await H.snap(page);
    console.log('after rewind: persuasionDone=%s sueAgreed=%s room=%s',
      rew.flags.includes('persuasionDone'), rew.flags.includes('sueAgreed'), rew.room);
    if (rew.flags.includes('persuasionDone')) throw new Error('rewind did not undo the choice');

    // galleries render
    const gal = await page.evaluate(()=>{
      Memories.renderList(); Endings.renderList();
      return { mem: document.querySelectorAll('#memoriesList .listItem').length,
               memUnlocked: document.querySelectorAll('#memoriesList .listItem:not(.locked)').length,
               end: document.querySelectorAll('#endingsList .listItem').length,
               counter: document.getElementById('menuEndCount').textContent };
    });
    console.log('galleries:', JSON.stringify(gal));
    console.log('OK');
  });
  if (H.errors.length) { console.log('ERRORS:'); H.errors.forEach(e=>console.log(' ',e)); } else console.log('no errors');
})().catch(e=>{ console.error('FAIL:', e.message); H.errors.forEach(x=>console.log(' ',x)); });
