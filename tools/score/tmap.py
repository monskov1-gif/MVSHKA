# -*- coding: utf-8 -*-
"""Такты в секунды и обратно, с учётом карты темпов.

    python3 tmap.py разбор.json bars 3          # таблица тактов
    python3 tmap.py разбор.json sec 12.5        # какой это такт
    python3 tmap.py разбор.json bar 16          # с какой секунды такт
"""
import json, sys
m = json.load(open(sys.argv[1])); div = m['div']
tempos = sorted(m['tempos']) or [(0, 500000)]
if tempos[0][0] > 0: tempos = [(0, tempos[0][1])] + tempos
marks = []; sec = 0.0; pt, pu = tempos[0]; marks.append((0, 0.0, pu))
for (t, u) in tempos[1:]:
    sec += (t - pt) / div * pu / 1e6; marks.append((t, sec, u)); pt, pu = t, u
def t2s(tick):
    lo, hi = 0, len(marks) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if marks[mid][0] <= tick: lo = mid
        else: hi = mid - 1
    t0, s0, u = marks[lo]; return s0 + (tick - t0) / div * u / 1e6
def s2t(s):
    lo, hi = 0, 0, 
    best = marks[0]
    for mk in marks:
        if mk[1] <= s: best = mk
    t0, s0, u = best
    return t0 + (s - s0) * 1e6 / u * div
mode = sys.argv[2]; BEATS = float(sys.argv[3]) if len(sys.argv) > 3 else 4
if mode == 'bars':
    BAR = BEATS * div
    last = max(n['t'] + n['d'] for n in m['notes'])
    nb = int(last // BAR) + 1
    for b in range(nb):
        if b % 4 == 0: print(f'такт {b+1:4d}  {t2s(b*BAR):8.2f} c')
elif mode == 'bar':
    BAR = float(sys.argv[4]) * div if len(sys.argv) > 4 else 4*div
    print(f'{t2s((BEATS-1)*BAR):.3f}')
elif mode == 'at':
    print(f'{t2s(BEATS*div):.3f}')
