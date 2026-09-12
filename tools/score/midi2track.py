# -*- coding: utf-8 -*-
"""MIDI -> партитура движка. Ноты переносятся как есть, без домысливания."""
import json, sys
J='/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad/gliere.json'
m=json.load(open(J)); div=m['div']; notes=m['notes']
FIRST, LAST = 1, 12                      # какие такты берём в петлю
BEATS = 6                                # 6/4
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def nm(p): return NAMES[p%12]+str(p//12-1)

lo = (FIRST-1)*BEATS*div
hi = LAST*BEATS*div
sel=[n for n in notes if lo <= n['t'] < hi]
sel.sort(key=lambda n:(n['t'], n['n']))
print(f'нот в петле: {len(sel)}  тактов: {LAST-FIRST+1}')

# 1. МЕЛОДИЯ — вся линия как есть
mel=[]
for n in sel:
    beat=(n['t']-lo)/div
    dur =max(0.25, n['d']/div)
    mel.append((round(beat*2)/2, nm(n['n']), round(dur*4)/4))
# снять точные дубли (в MIDI встречаются нулевой длительности)
seen=set(); clean=[]
for b,p,d in mel:
    if (b,p) in seen: continue
    seen.add((b,p)); clean.append((b,p,d))
print('после чистки:', len(clean))

# 2. АККОРДЫ — по одному на такт: берём только те созвучия, все ноты
#    которых реально звучат в этом такте, иначе подложка будет спорить
#    с мелодией.
QUAL=[('maj7',[0,4,7,11]),('m7',[0,3,7,10]),('7',[0,4,7,10]),('',[0,4,7]),
      ('m',[0,3,7]),('dim',[0,3,6]),('sus4',[0,5,7]),('sus2',[0,2,7]),('5',[0,7])]
chords=[]
for b in range(FIRST-1, LAST):
    t0=b*BEATS*div; t1=t0+BEATS*div
    inb=[n for n in notes if t0 <= n['t'] < t1]
    pcs={n['n']%12 for n in inb}
    bass=min(n['n'] for n in inb)%12
    best=None
    for q,steps in QUAL:
        if all(((bass+s)%12) in pcs for s in steps):
            best=(NAMES[bass]+q, len(steps)); break
    # ничего не подошло — держим один основной тон: подложка, которая
    # не может спорить с линией, лучше выдуманного трезвучия
    if not best: best=(NAMES[bass]+'1', 1)
    chords.append(best[0])
print('аккорды:', chords)

# 3. вывод в формате партитуры
def fmt(items, per=6):
    out=[]; line=[]
    for it in items:
        line.append(it)
        if len(line)==per: out.append(''.join(line)); line=[]
    if line: out.append(''.join(line))
    return out
notes_src=[f"[{b:g},'{p}',{d:g}]," for b,p,d in clean]
body='\n'.join('          '+ln for ln in fmt(notes_src))
print()
print("      chords:['" + "','".join(chords) + "'],")
print("        {i:'piano', kind:'melody', gain:.22, pan:.10, notes:[")
print(body.rstrip(','))
print("          ]},")
json.dump({'chords':chords,'notes':clean}, open('/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad/track.json','w'))
