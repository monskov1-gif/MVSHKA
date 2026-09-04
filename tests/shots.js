/* Скриншоты комнат — визуальная проверка компоновки. */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.SHOT_DIR || '/tmp/shots';
const ROOMS = (process.argv[2] || 'hell,lilithHall,hellStreet,forestEdge,communeRoad,communeYard,trialRoom,communeHall,corridor1,kitchen,bathroom,balcony,nightSpot,backAlley,witch3House,parkWalk,street').split(',');

(async () => {
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(500);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await page.waitForTimeout(300);
  await page.click('#btnNew'); await page.waitForTimeout(700);
  for (const key of ROOMS) {
    const ok = await page.evaluate(k => {
      if (!Rooms[k]) return false;
      for (const f in gameState.flags) gameState.flags[f] = true;
      gameState.flags.ending = false; gameState.flags.sueDead = false;
      gameState.flags.sueLeftDead = false; gameState.flags.lonerChase = false;
      Dialogue.active = false; Scene.active = false; Game.mode = 'explore';
      document.getElementById('dialogueBox').classList.remove('active');
      document.getElementById('fade').classList.remove('show');
      gameState.currentRoom = k;
      const r = Rooms[k];
      Player.x = r.w / 2; Player.y = r.h - 50;
      unstickPlayer(); World.invalidate(); Weather.apply(r);
      return true;
    }, key);
    if (!ok) { console.log('нет комнаты:', key); continue; }
    await page.waitForTimeout(900);
    await page.locator('#gameCanvas').screenshot({ path: `${OUT}/${key}.png` });
    console.log('снято:', key);
  }
  await browser.close();
  if (errs.length) { console.log('ОШИБКИ:'); errs.forEach(e => console.log(' ', e)); process.exit(1); }
  console.log('без ошибок');
})();
