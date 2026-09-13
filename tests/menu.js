/* Главное меню: заглавная тема играет и не подменяется.

   Раньше в меню звучала «Печаль», и после того, как в неё переехал
   средний раздел Шопена, это стало особенно заметно: игра открывалась
   траурным роялем. Плюс траур после смерти Сью подменял вообще всё,
   включая заглавную, — меню стоит вне сюжета, и его тема не должна
   зависеть от того, в каком состоянии лежит сохранение. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport:{width:420,height:820} });
  const errs=[];
  p.on('pageerror', e=>errs.push('PAGE: '+e.message));
  p.on('console', m=>{ if(m.type()==='error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
  await p.goto('file:///home/user/MVSHKA/index.html');
  await p.waitForFunction(()=>typeof Music!=='undefined');
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(()=>{ Audio.init(); Audio.resume(); showMenu(); });
  await p.waitForTimeout(1200);
  const inMenu = await p.evaluate(()=>({ cur:Music.cur, mode:Game.mode, timer:!!Music.timer, step:Music.step }));
  console.log('в главном меню:', JSON.stringify(inMenu));
  /* заглавная не должна подменяться траурной: меню вне сюжета */
  const mourn = await p.evaluate(()=>{
    DevTools.baseUni(1); DevTools.ensureRunning();
    gameState.flags.sueDead = true; gameState.flags.sueRevived = false; gameState.flags.sueLeftDead = false;
    Music.cur=null; showMenu();
    const r = Music.cur;
    gameState.flags.sueDead = false;
    return r;
  });
  console.log('меню при трауре:', mourn);
  await p.waitForTimeout(1500);
  const later = await p.evaluate(()=>({ cur:Music.cur, step:Music.step }));
  console.log('через полторы секунды:', JSON.stringify(later));
  console.log(errs.length ? 'ОШИБКИ: '+errs.join(' | ') : 'без ошибок');
  await b.close();
  process.exit(errs.length || inMenu.cur!=='intro' ? 1 : 0);
})();
