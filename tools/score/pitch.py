import json
H='/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad/heads.json'
heads=[hd for hd in json.load(open(H)) if hd['x'] > 258]     # правее ключа и размера
TREBLE=[291,301,312,324,335]; BASS=[432,442,453,464,477]
LET='CDEFGAB'; FLATS={'B','E','A','D','G'}
def conv(y):
    if y < 385: lines, base = TREBLE, 2        # нижняя линия скрипичного = E4
    else:       lines, base = BASS, -10        # нижняя линия басового = G2
    sp=(lines[-1]-lines[0])/8                  # одна ступень = полмежлинейного
    s = base + round((lines[-1]-y)/sp)
    l = LET[s%7]; o = 4 + s//7
    return f"{l}{'b' if l in FLATS else ''}{o}", ('G' if y<385 else 'F')
BAR=[258, 1046]                                 # тактовые черты по картинке
rows=[]
for hd in sorted(heads, key=lambda z:z['x']):
    n,c = conv(hd['y'])
    rows.append((hd['x'], hd['y'], c, n))
bar=1
prev=None
for x,y,c,n in rows:
    if prev is not None and x-prev > 46: print('   ----')
    print(f"x={x:7.1f}  {c}  {n}")
    prev=x
