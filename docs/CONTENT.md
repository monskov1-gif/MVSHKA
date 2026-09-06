# Реестр мира

Технический разрез: что где лежит и как называется. Сам сюжет — что
происходит, почему и каким тоном — в [`STORY.md`](STORY.md).

Всё ниже выгружено из работающей игры, а не написано по памяти.
Сводка: **55 комнат, 125 сцен, 123 флага, 17 счётчиков, 4 стата, 136 пропсов,
31 спрайт, 22 записи журнала, 58 целей, 25 воспоминаний, 4 концовки.**

## Персонажи

| Кто | Роль |
|---|---|
| **Ная** | героиня; унаследовала силу ведьмы от матери, работает официанткой |
| **Сью** | подруга детства, живут вместе; играет в студенческом театре |
| **Крис** | повар в кафе «У Мардж», прикрывает Наю на смене |
| **Френк** | отец Наи; предыстория разыгрывается в его доме |
| **Дризелла, Стейси** | сёстры из предыстории |
| **Женевьева Морель** | преподаватель театрального направления; ведьма, знала Медею |
| **Медея** | ведьма прошлого, к которой ведёт расследование |
| **Шарлотта** | ведьма, встречает Наю в аду и объясняет устройство |
| **Лиллит** | владычица ада |
| **Дороти** | ведьма коммуны |
| **Мадлен, Роза** | ведьмы коммуны — носительницы амулетов |
| **Агата, Беатрис, Руби** | ведьмы **из сказа**; в коммуне не появляются |

Спрайты (31): `naya, nayaDark, sue, sueGhost, nayaHell, chris, drizella, stacy,
frank, nayaTeen, genevieve, witch1..witch6, acolyte, customer, neighbor, friend,
student, imp, mother, motherWitch, sueChild, nayaChild, dorothy, dorothySit,
charlotte, lilith`.

## Структура истории

1. **Пролог.** Ад семнадцать лет назад, мать Наи. Затем площадка, детство,
   первая встреча со Сью.
2. **Предыстория.** Дом отца: фотографии, коробка, кристалл матери, разговоры
   с Дризеллой, Стейси и Френком. Выход — пригородная станция, не улица.
3. **Глава «Женевьева Морель».** Четыре дня в университете (ниже).
4. **Коммуна и амулеты.** Уговорить Сью, три дома ведьм, три амулета.
5. **Развилка.** Сью погибает; выбор — воскресить или оставить. Дальше ветки
   «злая Ная», «одиночка», «месть», «остаться».

### Четыре дня главы

Первые три дня в университет нельзя попасть, пока не отработана смена в кафе;
на четвёртый Наю подменяет Крис. Каждый день закрывается разговором со Сью:
Ная заходит в репетиционный зал, Сью обещает выйти, зал пустеет (на третий
день режиссёр остаётся с одним актёром), и разговор продолжается в коридоре.

| День | Задачи |
|---|---|
| 1 | имя в списке преподавателей · посмотреть репетицию · столкнуться с Морель в коридоре · символ на старой фотографии · спросить библиотекаря |
| 2 | сравнить материалы разных лет · найти источник символа · коробки театрального общества · понять, откуда Морель знает имя |
| 3 | найти настоящий архив · упоминания Медеи · сопоставить Медею и Морель · догнать Морель на крыше |
| 4 | проверить пропавшие материалы · осмотреть кабинет Морель · найти пропавшую папку · попасть на премьеру Сью |

На четвёртый день охрана перекрывает главный вход; обратно — через задний двор
и низкое окно служебной лестницы. Знакомой дорогой через старое крыло тоже
можно, и логика предметов это учитывает.

### Концовки

| | Название | Условие в двух словах |
|---|---|---|
| I | ОДИНОЧКА | Сью отказалась, Ная пошла одна |
| II | ЗЛАЯ ВЕДЬМА | Ная выбрала силу, человечность на нуле |
| III | МЕСТЬ | Сью мертва, Ная идёт путём ведьмы |
| IV | ОСТАТЬСЯ | Сью воскрешена, Ная отказалась от силы |

Текст карточки зависит от статов: `trustSue`, `witchAmbition`, `humanity`.

## Комнаты

Формат: ключ, размер, название.

```
БЫТ            nayaRoom 240x300 Комната Наи и Сью · corridor1 280x300 Коридор
               kitchen 210x230 · bathroom 190x210 · balcony 280x240
               stairwell 240x300 Прихожая
ГОРОД          street 640x320 Мейпл-стрит · cafe 300x300 Кафе «У Мардж»
               oldTown 360x320 Старый квартал · backAlley 240x300 Переулок
               parkWalk 420x300 Городской парк · departureStation 360x300 Станция
               playgroundNow 300x300 Площадка на окраине
ПРЕДЫСТОРИЯ    oldHouse 320x300 Дом отца · oldHouseAttic 240x280 Чердак
               playground 300x300 · prologueHell 240x320 Ад, семнадцать лет назад
ВЕДЬМЫ         genevieveHouse 240x300 · witch1House 320x340 Дом Мадлен
               witch2House 320x340 Дом Розы · witch3House 320x340 Дом за городом
               nightSpot 320x320 За городом, ночь
КОММУНА        communeRoad 380x280 · communeYard 340x300 · communeHall 300x300
               trialRoom 260x260 Комната испытания · forestEdge 340x300
АД             hell 320x340 Нижний город · lilithHall 360x380 Тронный зал
               hellFinal 300x340 Галерея · hellStreet 400x300 Площадь
УНИВЕРСИТЕТ    uniFrontYard 500x360 Передний двор · uniHall 440x360 Главный холл
   1 этаж      uniWestHall 260x620 Западное крыло · uniEastHall 260x660 Восточное
               uniRehearsal 300x320 Репетиционный зал · uniDressing 240x260 Гримёрная
               uniCostume 200x220 Костюмерная · uniTheatre 300x400 Театральный зал
               uniTeachersRoom 240x200 Преподавательская · uniLibrary 320x300 Библиотека
               uniMorelOffice 220x240 Кабинет Морель · uniAud14 280x240 Аудитория 14
               uniMusicRoom 240x220 · uniArtRoom 260x240 · uniCourtyard 420x320 Двор
   2 этаж      uniCorr2 680x300 · uniWest2 260x400 · uniEast2 260x400
   старое      uniOldWing 520x320 · uniServiceStair 220x420 Служебная лестница
               uniBasement 440x280 Цоколь · uniArchive 320x280 Цокольный архив
               uniRoof 340x260 Крыша · uniBackYard 420x290 Задний двор
```

## Граф переходов

```
nayaRoom      door→corridor1 (или communeRoad в финале)
corridor1     toRoom→nayaRoom  toKitchen  toBath  toBalcony  toStairs→stairwell
stairwell     toFlat→corridor1  toStreet→street
street        toCafe  toHome→stairwell  toLeftHouse→witch1House
              toRightHouse→genevieveHouse  toUni→uniFrontYard  uniBackYard
              toOldTown  toAlley→backAlley  toPark→parkWalk
oldTown       toStreet  toPlayground→playgroundNow  toRose→witch2House
              toNightRoad→nightSpot
nightSpot     exit→oldTown  enter→witch3House
genevieveHouse exit→street  toCommune→communeHall
communeRoad   back→street  onward→communeYard → inside→communeHall → toTrial→trialRoom
hell          portal→corridor1  toLilith→lilithHall
oldHouse      toAttic→oldHouseAttic ;  departureStation back→oldHouse

uniFrontYard  mainEntrance→uniHall  toStreet→street
uniHall       toFrontYard  toWest→uniWestHall  toEast→uniEastHall
              toCourtyard→uniCourtyard  toFloor2→uniCorr2
uniWestHall   toHall  toFloor2→uniWest2  toRehearsal  toDressing  toTheatre  toTeachers
uniEastHall   toHall  toFloor2→uniEast2  toLib  office→uniMorelOffice  aud14
              toMusic  toArt
uniCorr2      toFloor1→uniHall  toWest2  toEast2  toOldWing
uniWest2      toCorr2  toFloor1→uniWestHall        uniEast2  toCorr2  toFloor1→uniEastHall
uniOldWing    toCorr2  toService→uniServiceStair
uniServiceStair up→uniRoof  down→uniBasement  toOldWing  window→uniBackYard
uniBasement   up→uniServiceStair  toArchive→uniArchive → back→uniBasement
uniBackYard   toStreet→street  window→uniServiceStair
```

`hellFinal`, `hellStreet`, `forestEdge`, `playground`, `prologueHell` —
катсценные подложки без выходов.

## Флаги

123 флага. Значимые группы:

* **пролог и предыстория** — `prologueComplete`, `prologPlayground`,
  `backstoryDone`, `pastPhotos`, `pastBox`, `pastMotherPhoto`, `pastCrystal`,
  `pastDrizellaDone`, `pastStacyDone`, `pastFrankDone`, `pastTalkedAll`;
* **университет, день 1–2** — `uniArrived`, `uniHallStands`, `uniTeacherList`,
  `sawRehearsal`, `metGenevieveUni`, `symbolPhoto`, `libAsked`, `libPeriods`,
  `propsSymbol`, `propsMorel`, `morelKnowsName`;
* **университет, день 3–4** — `basementFound`, `archiveMedeaFound`,
  `archiveMorelFound`, `roofPromise`, `libMissing`, `morelPhotoSeen`,
  `universityBanned`, `backWindowUsed`, `knowsServiceRoute`,
  `archiveFolderFound`, `premiereDone`, `morelTruth`, `communeInvite`;
* **«была там сегодня»** — `sawFloor2`, `sawOldWing`, `sawBasement`.
  Сбрасываются в `UniDay.advance()`, значат только текущий день;
* **кафе** — `cafeShiftStarted`, `cafeShiftFinished`, `chrisCovering`;
* **амулеты и коммуна** — `firstAmulet`, `secondAmulet`, `thirdAmulet`,
  `firstWitchDead`, `communePanic`, `communeWarded`, `thirdHouseOpen`;
* **развилка** — `sueDead`, `reviveChoiceMade`, `sueRevived`, `sueLeftDead`,
  `pathChosen`, `chosenWitchPath`, `chosenEarthPath`, `gaveCrystalAway`;
* **ветка «злая Ная»** — 12 флагов с префиксом `evil`;
* **ветка «одиночка»** — 8 флагов с префиксом `loner`.

**Счётчики (17):** `uniDay`, `sueRehearsal`, `campusHeat`,
`cafeMinigameProgress`, `witch2Distract`, `mirrorLooks`, `impTalks`,
`silenceLooks`, `libClues`, `sueResolve`, `sueRespected`, `persuadeStep`,
`postStep`, `catPets`, `runesDisarmed`, `lonerFails`, `evilLooks`.

**Статы (4):** `trustSue`, `witchAmbition`, `humanity`, `hellAffinity`.

## Журнал расследования

22 записи, по дням: день 1 — `goalUni`, `teacherList`, `morelPendant`,
`symbolPhoto`, `libOld`; день 2 — `libPeriods`, `propsSymbol`, `propsMorel`,
`morelKnows`; день 3 — `archiveBelow`, `serviceRoute`, `archiveMedea`,
`archiveMorel`, `roofPromise`; день 4 — `chrisCover`, `libMissing`,
`morelPhoto`, `banned`, `folderFound`, `premiere`, `morelTruth`,
`communeInvite`.

## Сцены

125 сценариев в `Scripts`. Крупные блоки:

* **пролог и предыстория** — `prologue`, `prologSwing`, `prologBackstory`,
  `pastDrizella`, `pastStacy`, `pastFrank`, `pastCrystalScene`, `prologLeave`;
* **университет** — `uniDay1Arrive`, `rehearsalDay1..4`, `sueRehearsalTalk`,
  `sueWaitingCorridor`, `sueDayEnd1..3`, `uniDayEnd`, `uniDay4Morning`,
  `morelPendant`, `morelOldCorridor`, `librarian*`, `library*`, `props*`,
  `archiveFolder*`, `archiveMissingFolder`, `morelPhoto`, `securityBan`,
  `premiereShow`, `roofPromise`, `roofTruth`, `dailyCafeShift`, `chrisShiftDay*`;
* **коммуна и амулеты** — `communeIntroScene`, `persuadeSue`, `persuade1..3`,
  `firstAmuletScene`, `secondAmuletScene`, `thirdAmuletScene`, `distractWitch2`,
  `communePanicScene`, `communeWardScene`;
* **развилка и ветки** — `reviveChoice`, `reviveSue`, `leaveSueDead`,
  `evil*` (13 сцен), `loner*` (6 сцен), `postRevival`, `silenceScene`,
  `regretScene`, `sueFearScene`, `reflectionScene`, `hellFinalScene`,
  `earthEnding`, `endingLoner`.

**Повторяемые (`Scene.DISPATCHERS`, 22):** `pastCheck`, `rehearsalWatch`,
`sueRehearsalTalk`, `sueDayWait`, `sueWaitingCorridor`, `libraryFolk`,
`librarianTalk`, `dressingCostumes`, `libraryArchive`, `archiveFolder15`,
`archiveFolder5`, `chrisShiftDay`, `dailyCafeShift`, `persuadeSue`,
`persuadeResolve`, `sueHint`, `distractWitch2`, `dorothy`, `dorothyHall`,
`postRevival`, `lonerDoor`, `lonerCaughtScene`.

**Свои пересказы (`Recap.LINES`, 18):** `pastFrank`, `pastDrizella`,
`pastStacy`, `prologSwing`, `playgroundMemory`, `cafeScene`, `homeTalkWithSue`,
`meetLilith`, `meetGenevieve`, `genevieveReveal`, `morelPendant`,
`morelOldCorridor`, `roofPromise`, `securityBan`, `premiereShow`,
`firstAmuletScene`, `secondAmuletScene`, `thirdAmuletScene`. Остальные сцены
пересказываются `Recap.generic()` — последним фактом журнала и текущей целью.

## Точки меню разработчика

```
uni_day1_hall      → uniHall          uni_day4_banned    → uniFrontYard
uni_day1_rehearsal → uniRehearsal     uni_day4_bypass    → uniBackYard
uni_day1_library   → uniLibrary       uni_day4_morel     → uniMorelOffice
uni_day2_library   → uniLibrary       uni_day4_archive   → uniArchive
uni_day2_theatre   → uniWestHall      uni_day4_premiere  → uniTheatre
uni_day3_oldwing   → uniOldWing       uni_day4_roof_truth→ uniRoof
uni_day3_basement  → uniBasement      commune_invite     → uniRoof
uni_day3_archive   → uniArchive
uni_day3_roof      → uniRoof
```

## Тесты

```
tests/harness.js        общий каркас: newGame, step, snap, pump, university, toUni
tests/run.js [I|II|III|IV]  четыре концовки от начала до карточки
tests/evil.js           быстрый прогон ветки «Ная выбрала силу»
tests/chapter.js        четыре дня главы подряд: дни, журнал, запрет, обход
tests/goals.js          цель меняется на каждом шаге и называет место
tests/archive.js        четвёртый день: цель про папку и коробки говорят об одном
tests/campus.js         внимание охраны, высылка, обходной путь
tests/shift.js          смена в кафе доигрывается до конца
tests/dev.js            меню разработчика: точки, все 55 комнат, кадр не чёрный
tests/reach.js          до каждого интерактива можно дойти ногами (с мебелью)
tests/depth.js          якоря, спавны, глубина, все вызовы changeRoom
tests/persist.js        сохранение, загрузка, перемотка, галереи
tests/prologue.js       во время пролога на экране нет взрослой Наи
tests/swing.js          траектория качелей по кадрам: Сью летит, а не дёргается
tests/legend.js         сказ о Мидее: существо собирается и видно целиком
tests/shift_clicks.js   мини-игра глазами человека: читает экран и кликает
tests/shots.js          скриншоты комнат — визуальная проверка компоновки
```
