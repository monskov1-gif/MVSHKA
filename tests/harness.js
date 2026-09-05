const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const errors = [];

async function pump(page, picks, tag) {
  let ci = 0, guard = 0;
  while (guard++ < 3000) {
    const st = await page.evaluate(() => ({
      dlg: Dialogue.active, choice: Dialogue.awaitingChoice, scene: Scene.active,
      mode: Game.mode, ending: Game.endingShown, montage: Game.montage,
      shift: document.getElementById('shiftScreen').classList.contains('show'),
      n: document.querySelectorAll('#choiceOptions .choiceOpt').length,
      texts: [...document.querySelectorAll('#choiceOptions .choiceOpt')].map(b => b.textContent.slice(0, 46)),
    }));
    if (st.ending) return 'ending';
    // смена в кафе: харнесс отрабатывает её как обычный игрок — читает рецепт
    // со экрана и жмёт следующий по порядку ингредиент
    if (st.shift) {
      const done = await page.evaluate(() => {
        const rec = document.getElementById('shiftRecipe').textContent;
        const steps = (rec.split(': ')[1] || '').split(' → ').filter(Boolean);
        const tray = document.querySelectorAll('#shiftTray span').length;
        const want = steps[tray];
        if (!want) return false;
        const btns = [...document.querySelectorAll('.shiftBtn')];
        const b = btns.find(x => x.textContent === want);
        if (!b) return false;
        b.click(); return true;
      });
      await page.waitForTimeout(done ? 130 : 220);
      continue;
    }
    if (st.choice && st.n > 0) {
      const want = picks[ci] !== undefined ? picks[ci] : 0;
      const k = Math.min(want, st.n - 1);
      if (process.env.VERBOSE) console.log(`   [${tag}] choice#${ci} -> ${k}/${st.n}: ${st.texts[k]}`);
      ci++;
      await page.evaluate(k => document.querySelectorAll('#choiceOptions .choiceOpt')[k].click(), k);
      await page.waitForTimeout(220);
      continue;
    }
    if (st.dlg) { await page.evaluate(() => Dialogue.advance()); await page.waitForTimeout(12); continue; }
    if (st.scene || st.montage || st.mode === 'transition' || st.mode === 'cutscene') { await page.waitForTimeout(70); continue; }
    // delayed onEnter scenes fire on a timer, so give them a grace window before calling it idle
    await page.waitForTimeout(1600);
    const st2 = await page.evaluate(() => ({ dlg: Dialogue.active, scene: Scene.active, mode: Game.mode }));
    if (st2.dlg || st2.scene || st2.mode !== 'explore') continue;
    return { state: 'idle', consumed: ci };
  }
  throw new Error('pump guard tripped at ' + tag);
}

const useObj = (page, n) => page.evaluate(n => {
  const room = Rooms[gameState.currentRoom];
  const o = roomObjs(room).find(x => x.name === n);
  if (!o) return 'MISSING obj ' + n + ' in ' + gameState.currentRoom;
  Player.x = o.x + o.w / 2; Player.y = o.y + o.h / 2 + 6;
  doInteract(); return 'ok';
}, n);

const useNpc = (page, n) => page.evaluate(n => {
  const room = Rooms[gameState.currentRoom];
  const p = roomNPCs(room).find(x => x.name === n);
  if (!p) return 'MISSING npc ' + n + ' in ' + gameState.currentRoom;
  Player.x = p.x; Player.y = p.y + 9;
  doInteract(); return 'ok';
}, n);

const snap = page => page.evaluate(() => ({
  room: gameState.currentRoom, act: gameState.act, chapter: gameState.chapter,
  stats: gameState.stats, inv: gameState.inventory.slice(),
  mem: gameState.memories.length,
  flags: Object.entries(gameState.flags).filter(([k, v]) => v).map(([k]) => k),
}));

async function step(page, kind, name, picks, tag) {
  const r = kind === 'obj' ? await useObj(page, name) : await useNpc(page, name);
  if (r !== 'ok') throw new Error(`${tag}: ${r}`);
  await page.waitForTimeout(120);
  return pump(page, picks || [], tag + ':' + name);
}

async function newGame(page) {
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(400);
  await page.click('#btnNew');
  await page.waitForTimeout(700);
  await pump(page, [], 'intro');
}

/* --- shared opening: prologue .. commune intro --- */
async function opening(page, picks, tag) {
  // prologue: hell narration, chapter card, then the playground as little Sue
  await pump(page, [], tag + ':prologue');
  await step(page, 'obj', 'swing', [], tag);                       // первая магия -> дом отца
  // пролог, часть вторая: дом отца, прощание, кристалл
  await step(page, 'npc', 'Дризелла', [0], tag);
  await step(page, 'npc', 'Стейси', [], tag);
  await step(page, 'npc', 'Фрэнк', [2, 2], tag);   // два выбора: почему не вмешался, затем про маму
  await step(page, 'obj', 'toAttic', [], tag);
  await step(page, 'obj', 'deskPast', [], tag);
  await step(page, 'obj', 'toLiving', [], tag);
  await step(page, 'obj', 'frontDoor', [], tag);                  // -> глава 2
  // an ordinary morning, then out to work
  await step(page, 'obj', 'door', [], tag);                        // -> flat hallway
  await step(page, 'obj', 'toStairs', [], tag);                    // -> entry hall
  await step(page, 'obj', 'toStreet', [], tag);                    // -> street
  await step(page, 'obj', 'toCafe', [picks.cafe], tag);            // the shift, and Chris
  await step(page, 'obj', 'exit', [], tag);                        // -> street
  await step(page, 'obj', 'toUni', [], tag);                       // автобус -> главный холл
  await step(page, 'obj', 'toTheatre', [], tag);                   // -> театральное крыло
  await step(page, 'obj', 'toStage', [], tag);                     // -> сцена
  await step(page, 'npc', 'Сью', [], tag);                         // прогон
  await step(page, 'obj', 'exit', [], tag);                        // -> коридор крыла
  await step(page, 'obj', 'toHall', [], tag);                      // -> главный холл
  await step(page, 'obj', 'toStudy', [], tag);                     // -> учебное крыло
  await step(page, 'obj', 'aud14', [picks.gen], tag);              // Женевьева, кристалл отзывается
  await step(page, 'obj', 'toLib', [], tag);                       // -> библиотека
  await step(page, 'obj', 'shelfFolk', [], tag);
  await step(page, 'obj', 'shelfTheatre', [], tag);
  await step(page, 'obj', 'archive', [], tag);                     // Medea
  await step(page, 'npc', 'Женевьева', [picks.reveal], tag);       // the world explained -> home
  await step(page, 'npc', 'Сью', [picks.home], tag);               // home talk -> hell
  await step(page, 'obj', 'toLilith', [picks.lilith], tag);        // Lilith -> home
  await step(page, 'npc', 'Сью', [], tag);                         // sueAfterHell
  await step(page, 'obj', 'door', [], tag);
  await step(page, 'obj', 'toStairs', [], tag);
  await step(page, 'obj', 'toStreet', [], tag);
  await step(page, 'obj', 'toRightHouse', [], tag);                // Genevieve at home
  await step(page, 'obj', 'toCommune', [], tag);                   // commune intro
  await step(page, 'obj', 'exit', [], tag);
  await step(page, 'obj', 'exit', [], tag);                        // -> street
  await step(page, 'obj', 'toHome', [], tag);                      // -> entry hall
  await step(page, 'obj', 'toFlat', [], tag);                      // -> hallway
  await step(page, 'obj', 'toRoom', [], tag);                      // -> the room
}

async function amuletArc(page, picks, tag) {
  await step(page, 'obj', 'door', [], tag);
  await step(page, 'obj', 'toStairs', [], tag);
  await step(page, 'obj', 'toStreet', [], tag);
  await step(page, 'obj', 'toLeftHouse', [], tag);                // Madlen's house
  await step(page, 'obj', 'altar', [picks.amulet1], tag);         // -> naya room
  await step(page, 'obj', 'door', [], tag);
  await step(page, 'obj', 'toStairs', [], tag);
  await step(page, 'obj', 'toStreet', [], tag);
  await step(page, 'obj', 'toRightHouse', [], tag);               // genevieve
  await step(page, 'obj', 'toCommune', [], tag);                  // panic scene
  await step(page, 'obj', 'exit', [], tag);
  await step(page, 'obj', 'exit', [], tag);                       // -> street
  await step(page, 'obj', 'toOldTown', [], tag);                  // old quarter
  await step(page, 'obj', 'toRose', [], tag);                     // Rose's own house
  for (let i = 0; i < 3; i++) await step(page, 'npc', 'Роза', [], tag);
  await step(page, 'obj', 'cabinet', [picks.amulet2], tag);       // -> naya room
  await step(page, 'obj', 'door', [], tag);
  await step(page, 'obj', 'toStairs', [], tag);
  await step(page, 'obj', 'toStreet', [], tag);
  await step(page, 'obj', 'toRightHouse', [], tag);               // genevieve
  await step(page, 'obj', 'toCommune', [], tag);                  // ward scene
  await step(page, 'obj', 'exit', [], tag);
  await step(page, 'obj', 'exit', [], tag);                       // -> street
  await step(page, 'obj', 'toOldTown', [], tag);
  await step(page, 'obj', 'toNightRoad', [], tag);                // out of town
  await step(page, 'obj', 'enter', [], tag);                      // witch3 house
  await step(page, 'obj', 'rune1', [], tag);
  await step(page, 'obj', 'rune2', [], tag);
  await step(page, 'obj', 'rune3', [], tag);
  await step(page, 'obj', 'chest', [], tag);                      // sue dies -> naya room
}

async function run(name, fn) {
  const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--no-first-run','--disable-sync','--disable-default-apps'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  await page.goto(URL);
  await page.waitForTimeout(500);
  let out;
  try { out = await fn(page); }
  finally { await browser.close(); }
  return out;
}
module.exports = { run, newGame, opening, amuletArc, step, pump, snap, useObj, useNpc, errors };
