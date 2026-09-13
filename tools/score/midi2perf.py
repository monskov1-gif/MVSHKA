# -*- coding: utf-8 -*-
"""MIDI -> «живое исполнение» для движка.

Отличие от midi2track.py: там ноты кладутся на сетку восьмых, здесь —
на своё место во времени, с силой нажатия и с педалью. Нужно для вещей,
записанных не как партитура, а как игра человека: рубато, раскатанные
аккорды, неровности. На сетке всё это пропадает.

Формат ноты: [доля от начала петли, номер MIDI, длительность в долях,
сила 0..127]. Доли — четвертные.
"""
import json, sys

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OPT  = dict(a[2:].split('=', 1) if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
sys.argv = [sys.argv[0]] + ARGS
SRC = sys.argv[1] if len(sys.argv) > 1 else 'chopin.json'
FIRST, LAST = int(sys.argv[2]), int(sys.argv[3])          # такты, с 1
BEATS = int(sys.argv[4]) if len(sys.argv) > 4 else 4      # долей в такте
NAME  = sys.argv[5] if len(sys.argv) > 5 else 'perf'

m = json.load(open(SRC))
div = m['div']; notes = m['notes']; ped = m.get('pedal', [])
lo = (FIRST-1)*BEATS*div
hi = LAST*BEATS*div

def pedal_release(t):
    """тик, когда педаль отпустят после момента t (или None)"""
    down = None
    for (pt, on) in ped:
        if pt <= t: down = on
        elif down and not on: return pt
        elif pt > t: 
            if down: 
                for (qt, q) in ped:
                    if qt > t and not q: return qt
            return None
    return None

sel = [n for n in notes if lo <= n['t'] < hi]
sel.sort(key=lambda n: (n['t'], n['n']))
out = []
for n in sel:
    beat = (n['t'] - lo) / div
    end  = n['t'] + n['d']
    rel  = pedal_release(n['t'])
    if rel and rel > end: end = rel                      # педаль держит ноту
    dur = max(0.08, (end - n['t']) / div)
    dur = min(dur, BEATS * 2.0)                          # но не бесконечно
    out.append([round(beat, 3), n['n'], round(dur, 3), n['v']])

# ---------------------------------------------------------------- #
# ОГРАНКА. Нужна только там, где MIDI набран, а не сыгран: ровная
# сетка, одна сила нажатия на всё, педали нет. Такое воспроизведение
# звучит как заводная шкатулка, и никакой тембр этого не исправит.
# Всё ниже включается флагами и по умолчанию выключено.
# ---------------------------------------------------------------- #
def bars_of(items):
    """ноты, сгруппированные по тактам"""
    g = {}
    for it in items: g.setdefault(int(it[0] // BEATS), []).append(it)
    return g

if 'ped' in OPT:
    # Педаль, которой нет в файле, но которая есть в нотах: у Глиэра
    # «Ped.» стоит на каждое полутакта. Нота звучит до конца своего
    # отрезка — от этого арпеджио сливается в гармонию, а не сыплется.
    step = float(OPT['ped'])
    for it in out:
        seg_end = (int(it[0] / step) + 1) * step
        it[2] = round(max(it[2], seg_end - it[0] + step * 0.35), 3)

if 'dyn' in OPT:
    # Громкость по тактам, снятая с живой записи: цифра 0..9 на такт.
    curve = OPT['dyn']
    for b, items in bars_of(out).items():
        k = 0.60 + int(curve[b % len(curve)]) / 9 * 0.65
        for it in items: it[3] = max(1, min(127, round(it[3] * k)))

if 'voice' in OPT:
    # Голосоведение: верхняя нота волны — мелодия, её слышно; нижняя —
    # бас, он держит; середина тише обоих. Пианист так и играет.
    for b, items in bars_of(out).items():
        hi_n = max(i[1] for i in items); lo_n = min(i[1] for i in items)
        for it in items:
            if   it[1] == hi_n: it[3] = min(127, round(it[3] * 1.30))
            elif it[1] == lo_n: it[3] = min(127, round(it[3] * 1.12))
            else:               it[3] = max(1,   round(it[3] * 0.86))

if 'human' in OPT:
    # Микросдвиги: доля такта приходит чуть раньше, вершина волны чуть
    # задерживается (агогика), всё остальное дышит в пределах 8 мс.
    import random
    random.seed(7)
    q = float(OPT.get('human', 1)) if OPT.get('human', '1') != '1' else 1.0
    for b, items in bars_of(out).items():
        hi_n = max(i[1] for i in items)
        for it in items:
            d = random.uniform(-0.018, 0.018) * q
            if abs(it[0] - b * BEATS) < 1e-6: d -= 0.030 * q      # бас чуть раньше
            if it[1] == hi_n:                 d += 0.035 * q      # вершина чуть позже
            it[0] = round(max(0, it[0] + d), 3)
    out.sort(key=lambda it: it[0])

loop = (LAST - FIRST + 1) * BEATS
print(f'// {NAME}: такты {FIRST}–{LAST}, {len(out)} нот, петля {loop} долей')
print(f'      loopBeats:{loop}, perf:[')
line = '        '
for it in out:
    s = '[' + ','.join(f'{v:g}' for v in it) + '],'
    if len(line) + len(s) > 96:
        print(line); line = '        '
    line += s
if line.strip(): print(line.rstrip(','))
print('      ],')
