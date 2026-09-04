const H = require('./harness.js');
const ENTRY = {
  nayaRoom:[120,255], corridor1:[120,210], street:[120,210], cafe:[120,268],
  hell:[160,240], lilithHall:[180,340], genevieveHouse:[120,258], communeHall:[150,268],
  witch1House:[120,258], witch2House:[120,258], nightSpot:[120,268], witch3House:[120,262],
  backAlley:[120,280], hellFinal:[150,300], parkWalk:[120,290],
  kitchen:[120,258], bathroom:[120,240], balcony:[120,192], stairwell:[120,108], oldTown:[30,280],
  prologueHell:[120,200], playground:[150,236], uniCourtyard:[200,268],
  uniStage:[120,262], uniLibrary:[120,258],
  uniHallMain:[190,300], uniCorridorTheatre:[340,140], uniCorridorLib:[398,140],
  uniCanteen:[170,268], uniOldWing:[470,150],
  forestEdge:[196,140], communeRoad:[30,180], communeYard:[40,220], trialRoom:[130,230],
  hellStreet:[60,220],
};
(async () => {
  const out = await H.run('REACH', async page => {
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload(); await page.waitForTimeout(300);
    await page.click('#btnNew'); await page.waitForTimeout(600);
    return page.evaluate((ENTRY) => {
      // turn every gate on so every interactable/NPC in every room is present
      for (const k in gameState.flags) gameState.flags[k] = true;
      gameState.flags.ending = false;
      const report = [];
      for (const key in Rooms) {
        const room = Rooms[key];
        if (room.cinematic) continue;      // no player control in these
        gameState.currentRoom = key;
        const [ex, ey] = ENTRY[key] || [120, room.h - 40];
        const STEP = 2;
        const free = (x, y) => {
          if (x < 4 || x > room.w - 4 || y < Player.h || y > room.h - 2) return false;
          const box = { x:x - Player.w/2, y:y - Player.h, w:Player.w, h:Player.h };
          for (const w of room.walls) if (rectHit(box, w)) return false;
          return true;   // NPCs are pushable obstacles, not level geometry
        };
        // snap the entry point to a free cell the way unstickPlayer would
        let sx = ex, sy = ey;
        if (!free(sx, sy)) {
          let found = false;
          for (let r = 2; r < 120 && !found; r += 2)
            for (let a = 0; a < 360 && !found; a += 15) {
              const tx = ex + Math.cos(a*Math.PI/180)*r, ty = ey + Math.sin(a*Math.PI/180)*r;
              if (free(tx, ty)) { sx = tx; sy = ty; found = true; }
            }
          if (!found) { report.push({ room:key, fatal:'entry point has no free space' }); continue; }
        }
        const seen = new Set(), q = [[Math.round(sx/STEP)*STEP, Math.round(sy/STEP)*STEP]];
        seen.add(q[0][0] + ',' + q[0][1]);
        const pts = [];
        while (q.length) {
          const [x, y] = q.pop();
          pts.push([x, y]);
          for (const [dx, dy] of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]) {
            const nx = x + dx, ny = y + dy, k2 = nx + ',' + ny;
            if (seen.has(k2)) continue;
            seen.add(k2);
            if (free(nx, ny)) q.push([nx, ny]);
          }
        }
        const bad = [];
        const targets = roomObjs(room).map(o => ({ n:o.name, x:o.x + o.w/2, y:o.y + o.h/2, kind:'obj' }))
          .concat(roomNPCs(room).map(n => ({ n:n.name, x:n.x, y:n.y, kind:'npc' })));
        for (const t of targets) {
          // doInteract uses (Player.x, Player.y-8) and a 30px radius
          const ok = pts.some(([px, py]) => {
            const dx = t.x - px, dy = t.y - (py - 8);
            return dx*dx + dy*dy < 30*30;
          });
          if (!ok) bad.push(t.kind + ':' + t.n);
        }
        report.push({ room:key, reachableCells:pts.length, unreachable:bad });
      }
      return report;
    }, ENTRY);
  });
  let fail = 0;
  for (const r of out) {
    if (r.fatal) { console.log(`FATAL ${r.room}: ${r.fatal}`); fail++; continue; }
    const bad = r.unreachable.length;
    if (bad) { fail++; console.log(`UNREACHABLE ${r.room.padEnd(15)} cells=${String(r.reachableCells).padEnd(5)} -> ${r.unreachable.join(', ')}`); }
    else console.log(`ok         ${r.room.padEnd(15)} cells=${r.reachableCells}`);
  }
  console.log(fail ? `\n${fail} room(s) with problems` : '\nall rooms fully reachable on foot');
})().catch(e => console.error('FAIL', e.message));
