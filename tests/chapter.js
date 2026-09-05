/* Глава «Женевьева Морель»: четыре дня университетского расследования.
   Тест проходит их подряд как игрок и проверяет, что каждый день
   закрывается, журнал наполняется, а обходной путь действительно нужен. */
const H = require('./harness.js');

const WANT_JOURNAL = [
  'goalUni','teacherList','morelPendant','symbolPhoto','libOld',
  'libPeriods','propsSymbol','propsMorel','morelKnows',
  'archiveBelow','archiveMedea','archiveMorel','roofPromise',
  'chrisCover','libMissing','morelPhoto','banned','serviceRoute',
  'folderFound','premiere','morelTruth','communeInvite',
];

(async () => {
  const out = await H.run('CHAPTER', async page => {
    await H.newGame(page);
    const tag = 'CH';
    // пролог и утро — тем же путём, что и в остальных прогонах
    await H.pump(page, [], tag + ':prologue');
    await H.step(page, 'obj', 'swing', [], tag);
    await H.step(page, 'npc', 'Дризелла', [0], tag);
    await H.step(page, 'npc', 'Стейси', [], tag);
    await H.step(page, 'npc', 'Фрэнк', [2, 2], tag);
    await H.step(page, 'obj', 'toAttic', [], tag);
    await H.step(page, 'obj', 'deskPast', [], tag);
    await H.step(page, 'obj', 'toLiving', [], tag);
    await H.step(page, 'obj', 'frontDoor', [], tag);
    await H.step(page, 'obj', 'door', [], tag);
    await H.step(page, 'obj', 'toStairs', [], tag);
    await H.step(page, 'obj', 'toStreet', [], tag);
    await H.step(page, 'obj', 'toCafe', [0], tag);
    await H.step(page, 'obj', 'exit', [], tag);

    await H.university(page, { gen:0, roof:0, photo:0, guard:0, reveal:0 }, tag);

    const s = await H.snap(page);
    const st = await page.evaluate(() => ({
      day: C('uniDay'),
      journal: gameState.journal.slice(),
      goal: (Quests.goal() || {}).t,
      room: gameState.currentRoom,
    }));
    return { flags: s.flags, chapter: s.chapter, ...st };
  });

  const bad = [];
  const must = ['metGenevieveUni','symbolPhoto','libPeriods','propsSymbol','propsMorel',
                'morelKnowsName','basementFound','archiveMedeaFound','archiveMorelFound',
                'learnedMedea','roofPromise','chrisCovering','libMissing','morelPhotoSeen',
                'universityBanned','backWindowUsed','archiveFolderFound','premiereDone',
                'morelTruth','learnedWitches','foundGenevieve','communeInvite',
                'investigatedUniversity'];
  must.forEach(f => { if (!out.flags.includes(f)) bad.push('нет флага ' + f); });
  WANT_JOURNAL.forEach(k => { if (!out.journal.includes(k)) bad.push('нет записи журнала ' + k); });
  if (out.day !== 5) bad.push('uniDay=' + out.day + ', ожидалось 5');
  if (out.chapter !== 5) bad.push('глава=' + out.chapter + ', ожидалось 5');
  if (out.room !== 'nayaRoom') bad.push('комната=' + out.room + ', ожидалась nayaRoom');

  console.log('день:', out.day, '| глава:', out.chapter, '| комната:', out.room);
  console.log('записей в журнале:', out.journal.length, 'из', WANT_JOURNAL.length);
  console.log('цель:', out.goal);
  if (bad.length) { bad.forEach(b => console.log('  ' + b)); console.log('\nПРОВАЛ'); process.exit(1); }
  console.log('\nOK: глава «Женевьева Морель» проходится целиком');
})();
