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
    if(r.room!==k || r.mode!=='explore' || r.stuck){
      bad.push('телепорт '+k+': комната '+r.room+', режим '+r.mode+(r.stuck?', игрок '+r.stuck:''));
      console.log('ПЛОХО телепорт '+k+' -> '+r.room+' '+r.mode+' '+r.stuck);
    }
  }
  console.log('телепорты проверены:', keys.length);

  // 5. закрытие кнопкой и Escape
  await p.evaluate(()=>DevTools.open(false)); await p.waitForTimeout(300);
  await p.click('#devClose'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>({shown:document.getElementById('devToolsScreen').classList.contains('show'), paused:Game.paused, mode:Game.mode}));
  if(st.shown) bad.push('кнопка «Закрыть» не закрывает меню');
  if(st.paused) bad.push('после закрытия игра осталась на паузе');

  await p.evaluate(()=>DevTools.open(false)); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>document.getElementById('devToolsScreen').classList.contains('show'));
  if(st) bad.push('Escape не закрывает меню');

  // 6. F8 открывает
  await p.keyboard.press('F8'); await p.waitForTimeout(400);
  st = await p.evaluate(()=>document.getElementById('devToolsScreen').classList.contains('show'));
  if(!st) bad.push('F8 не открывает меню');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  // 7. кнопка в паузе
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
