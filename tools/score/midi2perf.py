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
