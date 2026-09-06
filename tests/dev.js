const path=require('path');
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const URL='file://'+path.resolve('/home/user/MVSHKA','index.html');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const p=await b.newPage({viewport:{width:420,height:860}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await p.goto(URL); await p.waitForTimeout(900);
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(800);

  const bad=[];

  /* Главный симптом бага: локация не видна. Проверяем не флаги, а сам
     кадр — доля неполностью чёрных пикселей на игровом холсте плюс
     состояние заливки #fade и игрового цикла. */
  const screen = async () => p.evaluate(() => {
    const c = document.getElementById('gameCanvas');
    const g = c.getContext('2d', { willReadFrequently:true });
    let lit = 0, n = 0;
    try {
      const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4 * 37) { n++; if (d[i] + d[i+1] + d[i+2] > 24) lit++; }
    } catch (e) { return { err: String(e) }; }
    return {
      lit: n ? lit / n : 0,
      fade: document.getElementById('fade').classList.contains('show'),
      running: !!Game.running,
      paused: !!Game.paused,
      menu: document.getElementById('mainMenu').classList.contains('show'),
    };
  });
  const seeRoom = async (what) => {
    const v = await screen();
    if (v.err) { bad.push(what + ': холст не читается — ' + v.err); return; }
    const why = [];
    if (v.lit < 0.25) why.push('видно ' + Math.round(v.lit*100) + '% кадра');
    if (v.fade)    why.push('экран закрыт заливкой #fade');
    if (!v.running) why.push('игровой цикл не запущен');
    if (v.paused)  why.push('пауза');
    if (v.menu)    why.push('главное меню поверх');
    if (why.length) { bad.push(what + ': ' + why.join(', ')); console.log('ЧЁРНЫЙ ЭКРАН — ' + what + ': ' + why.join(', ')); }
  };
  // 1. открыть из главного меню
  await p.click('#btnDevMain'); await p.waitForTimeout(500);
  let st = await p.evaluate(()=>({shown:document.getElementById('devToolsScreen').classList.contains('show')}));
  if(!st.shown) bad.push('меню не открылось из главного меню');

  // 2. пройти по ВСЕМ сюжетным точкам
  const n = await p.evaluate(()=>DevTools.storyPoints.length);
  for (let i=0;i<n;i++){
    await p.evaluate(async (i)=>{ DevTools.open(false); await DevTools.applyPoint(DevTools.storyPoints[i]); }, i);
    await p.waitForTimeout(700);
    const r = await p.evaluate((i)=>({
      want: DevTools.storyPoints[i].room, got: gameState && gameState.currentRoom,
      id: DevTools.storyPoints[i].id, mode: Game.mode, paused: Game.paused,
      goal: (Quests.goal()||{}).t, day: C('uniDay'),
      overlay: document.getElementById('devToolsScreen').classList.contains('show'),
      fade: document.getElementById('fade').classList.contains('show'),
    }), i);
    const ok = r.want===r.got && (r.mode==='explore'||r.mode==='cutscene'||r.mode==='dialogue') && !r.paused && !r.overlay;
    console.log((ok?'ok  ':'ПЛОХО ')+r.id.padEnd(22)+r.got+(r.want!==r.got?' (ждали '+r.want+')':'')+
                '  день='+r.day+'  режим='+r.mode+(r.paused?' ПАУЗА':'')+(r.fade?' ЧЁРНЫЙ ЭКРАН':'')+'  цель: '+r.goal);
    if(!ok) bad.push('точка '+r.id+': комната '+r.got+' ждали '+r.want+', режим '+r.mode+(r.paused?', пауза':'')+(r.fade?', чёрный экран':''));
    await seeRoom('точка ' + r.id);
  }

  // 3. обе сетки должны заполниться кнопками
  await p.evaluate(()=>DevTools.open(false)); await p.waitForTimeout(300);
  const grids = await p.evaluate(()=>({
    story: document.querySelectorAll('#devStoryGrid .devBtn').length,
    uni:   document.querySelectorAll('#devRoomGrid .devBtn').length,
    world: document.querySelectorAll('#devWorldGrid .devBtn').length,
    all:   Object.keys(Rooms).length,
  }));
  console.log('кнопок: сюжет=%s университет=%s мир=%s (комнат всего %s)',
              grids.story, grids.uni, grids.world, grids.all);
  if(!grids.story) bad.push('сетка сюжетных точек пуста');
  if(grids.uni + grids.world !== grids.all)
    bad.push('в сетках переходов ' + (grids.uni+grids.world) + ' кнопок, а комнат ' + grids.all);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);

  // 4. телепорт во ВСЕ комнаты игры
  const keys = await p.evaluate(()=>Object.keys(Rooms));
  for (const k of keys){
    await p.evaluate(async (k)=>{ DevTools.open(false); await DevTools.teleport(k); }, k);
    await p.waitForTimeout(420);
    const r = await p.evaluate(()=>{
      const rm = Rooms[gameState.currentRoom];
      const box = {x:Player.x-Player.w/2, y:Player.y-Player.h, w:Player.w, h:Player.h};
      const stuck = !rm ? 'нет комнаты'
        : (rm.walls||[]).some(w=>rectHit(box,w)) ? 'в стене'
        : World.blockedByProps(rm, box) ? 'в мебели' : '';
      /* Комнаты-подложки для катсцен (пролог в аду) целиком закрыты
         стеной: ходить там негде и не нужно, это не баг. */
      const sealed = !!rm && (rm.walls||[]).some(w =>
        w.x <= 0 && w.y <= 0 && w.w >= (rm.w||240) && w.h >= (rm.h||300));
      return {room:gameState.currentRoom, mode:Game.mode, stuck: sealed ? '' : stuck, sealed};
    });
    if (r.sealed) console.log('  (катсценная комната ' + k + ' — ходить негде, проверяем только переход)');
    await seeRoom('телепорт ' + k);
    if(r.room!==k || r.mode!=='explore' || r.stuck){
      bad.push('телепорт '+k+': комната '+r.room+', режим '+r.mode+(r.stuck?', игрок '+r.stuck:''));
      console.log('ПЛОХО телепорт '+k+' -> '+r.room+' '+r.mode+' '+r.stuck);
    }
  }
  console.log('телепорты проверены:', keys.length);

  /* 5. Самый частый способ попасть в баг: начать новую игру, прыгнуть
     из меню прямо посреди пролога. Оборванная сцена не должна ни
     догонять игрока сменой комнаты, ни оставлять чёрную заливку. */
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(800);
  await p.click('#btnNew'); await p.waitForTimeout(2500);
  const inProlog = await p.evaluate(()=>({scene:Scene.active, room:gameState && gameState.currentRoom}));
  console.log('пролог идёт: сцена=%s комната=%s', inProlog.scene, inProlog.room);
  if(!inProlog.scene) bad.push('пролог не запустился — сценарий проверки не тот');
  await p.keyboard.press('F8'); await p.waitForTimeout(400);
  await p.evaluate(async ()=>{ await DevTools.applyPoint(DevTools.storyPoints[0]); });
  await p.waitForTimeout(900);
  await seeRoom('прыжок из пролога');
  const jumped = await p.evaluate(()=>({room:gameState.currentRoom, scene:Scene.active, mode:Game.mode}));
  console.log('после прыжка: комната=%s сцена=%s режим=%s', jumped.room, jumped.scene, jumped.mode);
  if(jumped.room!=='uniHall') bad.push('прыжок из пролога: комната '+jumped.room);
  // оборванный пролог не должен ожить и утащить игрока обратно
  await p.waitForTimeout(4000);
  const later = await p.evaluate(()=>({room:gameState.currentRoom, fade:document.getElementById('fade').classList.contains('show')}));
  console.log('через 4 секунды: комната=%s заливка=%s', later.room, later.fade);
  if(later.room!=='uniHall') bad.push('оборванный пролог продолжил работу: комната стала '+later.room);
  await seeRoom('через 4 секунды после прыжка');

  // 6. закрытие кнопкой и Escape
  await p.evaluate(()=>DevTools.open(false)); await p.waitForTimeout(300);
  await p.click('#devClose'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>({shown:document.getElementById('devToolsScreen').classList.contains('show'), paused:Game.paused, mode:Game.mode}));
  if(st.shown) bad.push('кнопка «Закрыть» не закрывает меню');
  if(st.paused) bad.push('после закрытия игра осталась на паузе');

  await p.evaluate(()=>DevTools.open(false)); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>document.getElementById('devToolsScreen').classList.contains('show'));
  if(st) bad.push('Escape не закрывает меню');

  // 7. F8 открывает
  await p.keyboard.press('F8'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>document.getElementById('devToolsScreen').classList.contains('show'));
  if(!st) bad.push('F8 не открывает меню');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // 8. кнопка в паузе
  await p.evaluate(()=>{ Game.mode='explore'; Game.paused=false;
    document.getElementById('pauseMenu').classList.remove('show'); togglePause(); });
  await p.waitForTimeout(400);
  const pauseOpen = await p.evaluate(()=>document.getElementById('pauseMenu').classList.contains('show'));
  if(!pauseOpen) bad.push('пауза не открылась');
  await p.evaluate(()=>document.getElementById('btnPauseDev').click());
  await p.waitForTimeout(400);
  st = await p.evaluate(()=>document.getElementById('devToolsScreen').classList.contains('show'));
  if(!st) bad.push('из паузы меню не открывается');

  await b.close();
  console.log('');
  errs.forEach(e=>{ console.log(e); bad.push(e); });
  if(bad.length){ console.log('\nПРОБЛЕМЫ:'); [...new Set(bad)].forEach(x=>console.log('  '+x)); process.exit(1); }
  console.log('OK: меню разработчика работает целиком');
})();
