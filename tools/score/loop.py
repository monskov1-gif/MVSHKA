# -*- coding: utf-8 -*-
"""Где вещь можно замкнуть в круг.

Петля звучит без шва, когда музыка в конце приходит туда же, откуда
началась. Значит, надо найти такую пару тактов (начало, конец), что
такт «конец» похож на такт «начало» — тогда стык читается как обычный
повтор, которых в музыке и так полно.

    python3 loop.py разбор.json [минимум_тактов]

Печатает несколько кандидатов: чем выше оценка, тем незаметнее шов.
"""
import json, sys, collections

SRC = sys.argv[1]
MINBARS = int(sys.argv[2]) if len(sys.argv) > 2 else 24
m = json.load(open(SRC))
div = m['div']; notes = m['notes']
cand = m['tsig'] or [(0, 4, 4, 24, 8)]
tsig = max(cand, key=lambda t: t[1] * 4 / t[2])
BEATS = tsig[1] * 4 / tsig[2]                 # четвертей в такте
BAR = int(BEATS * div)
bpm = round(60_000_000 / m['tempos'][0][1]) if m['tempos'] else 120
last = max(n['t'] + n['d'] for n in notes)
NB = int(last // BAR) + 1

def fingerprint(b):
    """чем такт пахнет: ступени, бас, верх, плотность, ритм"""
    inb = [n for n in notes if b*BAR <= n['t'] < (b+1)*BAR]
    if not inb: return None
    pcs = frozenset(n['n'] % 12 for n in inb)
    onset = frozenset(round((n['t'] - b*BAR) / div * 4) for n in inb)
    return (pcs, min(n['n'] for n in inb) % 12, max(n['n'] for n in inb) % 12,
            len(inb), onset)

F = [fingerprint(b) for b in range(NB)]

def close(a, b):
    """насколько два такта — одно и то же место музыки, 0..1"""
    if a is None or b is None: return 0.0
    s = 0.0
    s += 0.40 * len(a[0] & b[0]) / max(1, len(a[0] | b[0]))     # ступени
    s += 0.15 * (a[1] == b[1])                                   # бас
    s += 0.10 * (a[2] == b[2])                                   # верх
    s += 0.15 * (1 - min(1, abs(a[3]-b[3]) / max(1, max(a[3], b[3]))))
    s += 0.20 * len(a[4] & b[4]) / max(1, len(a[4] | b[4]))      # ритм
    return s

best = []
for start in range(0, min(NB, 48)):
    if F[start] is None: continue
    for end in range(start + MINBARS, NB):
        if F[end] is None: continue
        # сам стык
        sc = close(F[start], F[end])
        # и ещё три такта вперёд: случайное совпадение одного такта
        # ничего не значит, а четыре подряд — уже то же место
        for k in (1, 2, 3):
            if start+k < NB and end+k < NB:
                sc += close(F[start+k], F[end+k])
        sc /= 4
        # длинная петля лучше короткой
        sc *= 0.80 + 0.20 * min(1, (end-start) / (NB * 0.8))
        best.append((sc, start, end))
best.sort(reverse=True)
seen = set(); out = []
for sc, s, e in best:
    k = (s // 4, e // 4)
    if k in seen: continue
    seen.add(k); out.append((sc, s, e))
    if len(out) >= 8: break

print(f'{SRC.split("/")[-1]}: {NB} тактов, {tsig[1]}/{tsig[2]}, {bpm} bpm, '
      f'{round(last/div*60/bpm)} с целиком')
print('  оценка  такты        длит.   доля вещи')
for sc, s, e in out:
    beats = (e - s) * BEATS
    secs = beats * 60 / bpm
    print(f'  {sc:.3f}   {s+1:4d}–{e:<5d} {secs:6.0f} с  {(e-s)/NB*100:3.0f}%')
