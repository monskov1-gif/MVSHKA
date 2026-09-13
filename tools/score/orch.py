# -*- coding: utf-8 -*-
"""MIDI -> партия движка, с оркестровкой и реальным временем.

Отличие от midi2perf.py — три вещи.

1. ВРЕМЯ. Там доля считалась делением тиков: это верно, только пока темп
   один на всю вещь. В живых записях он не один: ritardando в конце фразы,
   accelerando к кульминации, fermata. Здесь тики сначала переводятся в
   секунды по карте темпов, и уже секунды — в доли по одному номинальному
   темпу. Рубато при этом остаётся в нотах, а не теряется.

2. ГОЛОСА. Оркестровый файл — это три десятка дорожек, и играть их все
   роялем бессмысленно. Дорожки раскладываются по инструментам движка,
   каждой группе даётся своё место в панораме и своя громкость.

3. ПЛОТНОСТЬ. Партитура пишется для ста человек, а движок строит на каждую
   ноту цепочку осцилляторов. Тремоло мандолины — это двадцать пять нот в
   секунду на одной высоте, у движка это должна быть одна долгая нота.
   Дубли партий в унисон — одна нота. Аккорд из десяти голосов — четыре.
   Без этого браузер захлёбывается, а звучит всё равно как каша.

    python3 orch.py разбор.json --from=СЕК --to=СЕК --bpm=N \
        --map="0=flute:-0.3; 32,33=strings:-0.2:0.9" \
        [--trem=0.3] [--chord=4] [--rate=26] [--drop=21,22] [--ped]

Инструмент может быть ударным: !k !K !s !h !t !c.
Порядок групп в --map — это важность: кого оставить, когда нот слишком много.
"""
import json, sys, collections

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OPT  = dict((a[2:].split('=', 1) if '=' in a else (a[2:], '1')) for a in sys.argv[1:] if a.startswith('--'))
SRC  = ARGS[0]
m = json.load(open(SRC))
div = m['div']; notes = m['notes']; ped = m.get('pedal', [])

# ---- карта темпов: тик -> секунда ----------------------------------- #
tempos = sorted(m['tempos']) or [(0, 500000)]
if tempos[0][0] > 0: tempos = [(0, tempos[0][1])] + tempos
marks = []; sec = 0.0; pt, pu = tempos[0][0], tempos[0][1]
marks.append((0, 0.0, pu))
for (t, u) in tempos[1:]:
    sec += (t - pt) / div * pu / 1e6
    marks.append((t, sec, u)); pt, pu = t, u

def t2s(tick):
    lo, hi = 0, len(marks) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if marks[mid][0] <= tick: lo = mid
        else: hi = mid - 1
    t0, s0, u = marks[lo]
    return s0 + (tick - t0) / div * u / 1e6

BPM   = float(OPT.get('bpm', 120))
S0    = float(OPT['from']) if 'from' in OPT else 0.0
S1    = float(OPT['to'])   if 'to'   in OPT else t2s(max(n['t'] + n['d'] for n in notes))
GAIN  = float(OPT.get('vel', 1.0))
COMP  = float(OPT.get('comp', 1.0))       # <1 подтягивает тихие ноты вверх
NAME  = OPT.get('name', 'perf')
TREM  = float(OPT.get('trem', 0))        # доли: склейка повторов одной высоты
CHORD = int(OPT.get('chord', 0))         # сколько голосов оставить в аккорде
RATE  = float(OPT.get('rate', 0))        # потолок нот в секунду
DEF   = OPT.get('def', 'piano')

# ---- раскладка дорожек ---------------------------------------------- #
# Правила идут по порядку; первое подошедшее и решает. Дорожка может
# быть разрезана по высоте: «1@0-48=bass» — только низ первой дорожки.
# Так фортепианная запись из двух дорожек раскладывается на бас, аккорды
# и мелодию, хотя в файле их никто не разделял.
rules = []
for part in OPT.get('map', '').split(';'):
    part = part.strip()
    if not part: continue
    trks, spec = part.split('=')
    bits = spec.split(':')
    ins = bits[0]
    pan = float(bits[1]) if len(bits) > 1 and bits[1] != '' else None
    vs  = float(bits[2]) if len(bits) > 2 and bits[2] != '' else 1.0
    for x in trks.split(','):
        x = x.strip()
        if not x: continue
        lo, hi = 0, 127
        if '@' in x:
            x, rg = x.split('@')
            a, b = rg.split('-'); lo, hi = int(a), int(b)
        tt = (range(int(x.split('-')[0]), int(x.split('-')[1]) + 1)
              if '-' in x else [int(x)])
        for t in tt: rules.append((t, lo, hi, ins, pan, vs, len(rules)))
def rule(n):
    for r in rules:
        if r[0] == n['trk'] and r[1] <= n['n'] <= r[2]: return r
    return None
plan_tracks = {r[0] for r in rules}
drop = {int(x) for x in OPT.get('drop', '').split(',') if x.strip()}
def pr(x):
    r = rule({'trk': x['trk'], 'n': x['n']})
    return r[6] if r else 900

# ---- отбор ----------------------------------------------------------- #
sel = []
for n in notes:
    if n['trk'] in drop: continue
    if OPT.get('only') and n['trk'] not in plan_tracks: continue
    s = t2s(n['t'])
    if s < S0 - 1e-9 or s >= S1: continue
    e = n['t'] + n['d']
    if 'ped' in OPT:
        for (pt_, on) in ped:
            if pt_ > n['t'] and not on:
                if pt_ > e: e = pt_
                break
    sel.append({'s': s, 'e': t2s(e), 'n': n['n'], 'v': n['v'], 'trk': n['trk']})
sel.sort(key=lambda x: (x['s'], x['n']))
raw = len(sel)

# ---- тремоло и дроби одной высоты ------------------------------------ #
if TREM > 0:
    gap = TREM * 60 / BPM
    bykey = collections.defaultdict(list)
    for x in sel: bykey[(x['trk'], x['n'])].append(x)
    keep = []
    for k, arr in bykey.items():
        arr.sort(key=lambda x: x['s'])
        cur = dict(arr[0])
        for nx in arr[1:]:
            if nx['s'] - cur['e'] <= gap and nx['s'] - cur['s'] <= gap * 3:
                cur['e'] = max(cur['e'], nx['e'])
                cur['v'] = max(cur['v'], nx['v'])
            else:
                keep.append(cur); cur = dict(nx)
        keep.append(cur)
    sel = sorted(keep, key=lambda x: (x['s'], x['n']))
after_trem = len(sel)

# ---- унисонные дубли партий ------------------------------------------ #
best = {}
for x in sel:
    k = (round(x['s'], 2), x['n'])
    if k not in best or pr(x) < pr(best[k]): best[k] = x
sel = sorted(best.values(), key=lambda x: (x['s'], x['n']))
after_dup = len(sel)

# ---- аккорд не шире, чем нужно --------------------------------------- #
if CHORD:
    byt = collections.defaultdict(list)
    for x in sel: byt[round(x['s'], 2)].append(x)
    keep = []
    for t, arr in byt.items():
        if len(arr) <= CHORD: keep += arr; continue
        arr.sort(key=lambda x: x['n'])
        # крайние голоса слышно, середину — нет
        want = [arr[0], arr[-1]]
        rest = sorted(arr[1:-1], key=lambda x: (pr(x), -x['v']))
        keep += want + rest[:CHORD - 2]
    sel = sorted(keep, key=lambda x: (x['s'], x['n']))
after_chord = len(sel)

# ---- потолок плотности ------------------------------------------------ #
if RATE:
    win = 0.5
    byw = collections.defaultdict(list)
    for x in sel: byw[int(x['s'] / win)].append(x)
    keep = []
    for w, arr in sorted(byw.items()):
        lim = int(RATE * win)
        if len(arr) <= lim: keep += arr; continue
        arr.sort(key=lambda x: (pr(x), -x['v']))
        keep += arr[:lim]
    sel = sorted(keep, key=lambda x: (x['s'], x['n']))

# ---- сборка ----------------------------------------------------------- #
ins_list = []; ins_idx = {}
def slot(ins, pan):
    k = (ins, pan if pan is not None else 0)
    if k not in ins_idx:
        ins_idx[k] = len(ins_list); ins_list.append(k)
    return ins_idx[k]

out = []
for x in sel:
    r = rule(x)
    ins, pan, vs = (r[3], r[4], r[5]) if r else (DEF, None, 1.0)
    beat = (x['s'] - S0) * BPM / 60
    dur  = min(12.0, max(0.06, (x['e'] - x['s']) * BPM / 60))
    v = x['v']
    if COMP != 1.0: v = 127 * (v / 127.0) ** COMP
    v = max(1, min(127, round(v * vs * GAIN)))
    out.append([round(beat, 2), x['n'], round(dur, 2), v, slot(ins, pan)])
out.sort(key=lambda x: (x[0], x[1]))
loop = round((S1 - S0) * BPM / 60, 2)
# После округления до сотых нота с самого края отрезка может встать
# ровно на длину петли — то есть за её пределы. Двигаем такие на шаг
# внутрь: иначе на стыке круга она не прозвучит вовсе.
for it in out:
    if it[0] >= loop: it[0] = round(loop - 0.01, 2)

lines = []; line = '        '
for it in out:
    s = '[' + ','.join(f'{v:g}' for v in it) + '],'
    if len(line) + len(s) > 100: lines.append(line); line = '        '
    line += s
if line.strip(): lines.append(line.rstrip(','))
inss = ','.join(f"['{a}',{b:g}]" for a, b in ins_list)

sys.stderr.write(
    f'{NAME}: {S0:.2f}–{S1:.2f} c · {raw}→{after_trem} тремоло →{after_dup} дубли '
    f'→{after_chord} аккорды →{len(out)} нот · {len(out)/(S1-S0):.1f} нот/с · '
    f'петля {loop} долей при {BPM:g} bpm · голосов {len(ins_list)}\n')
print(f'      bpm:{BPM:g}, loopBeats:{loop},')
print(f'      ins:[{inss}],')
print('      perf:[')
for l in lines: print(l)
print('      ],')
