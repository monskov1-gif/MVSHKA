import sys, json
sys.path.insert(0,'/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad')
from omr_lib import readpng, writepng
src, X0, X1, Y0, Y1 = sys.argv[1], *map(int, sys.argv[2:6])
w,h,g = readpng(src)
W,H = X1-X0, Y1-Y0
bm=bytearray(W*H)
for y in range(Y0,Y1):
    for x in range(X0,X1):
        bm[(y-Y0)*W+(x-X0)] = 1 if g[y*w+x] < 135 else 0
def at(x,y): return bm[y*W+x] if 0<=x<W and 0<=y<H else 0
# убрать только тонкие горизонтальные линии (нотный стан и добавочные)
for y in range(H):
    x=0
    while x<W:
        if at(x,y):
            s=x
            while x<W and at(x,y): x+=1
            if x-s>=18:
                thin = not (at(s+2,y-3) and at(s+2,y+3))
                if thin:
                    for k in range(s,x): bm[y*W+k]=0
        else: x+=1
# ядро «головка»: 13x7 почти сплошной чёрный
KW,KH=11,6
S2=[0]*((W+1)*(H+1))
for y in range(H):
    r=0
    for x in range(W):
        r+=bm[y*W+x]
        S2[(y+1)*(W+1)+x+1]=S2[y*(W+1)+x+1]+r
def box(x0,y0,x1,y1):
    x0=max(0,x0);y0=max(0,y0);x1=min(W,x1);y1=min(H,y1)
    return S2[y1*(W+1)+x1]-S2[y0*(W+1)+x1]-S2[y1*(W+1)+x0]+S2[y0*(W+1)+x0]
cands=[]
for y in range(H-KH):
    for x in range(W-KW):
        c=box(x,y,x+KW,y+KH)
        if c >= KW*KH*0.74:
            # вокруг не должно быть сплошняка — иначе это балка
            # балка — сплошная полоса намного шире головки
            wide=box(x-16,y+1,x+KW+16,y+KH-1)
            if wide <= (KW+32)*(KH-2)*0.90:
                cands.append((c,x+KW/2,y+KH/2))
cands.sort(reverse=True)
picked=[]
for c,cx,cy in cands:
    if all((cx-px)**2/1.0+(cy-py)**2/1.0 > 36 for px,py in [(p[1],p[2]) for p in picked]):
        picked.append((c,cx,cy))
picked.sort(key=lambda p:p[1])
print('головок:', len(picked))
json.dump([{'x':round(p[1]+X0,1),'y':round(p[2]+Y0,1)} for p in picked],
          open(f'{sys.path[0]}/heads.json','w'))
out=bytearray(g)
for c,cx,cy in picked:
    X,Y=int(cx)+X0,int(cy)+Y0
    for d in range(-9,10):
        for yy in (Y-8,Y+8):
            if X0<=X+d<X1 and Y0<=yy<Y1: out[yy*w+X+d]=0
    for d in range(-8,9):
        for xx in (X-9,X+9):
            if X0<=xx<X1 and Y0<=Y+d<Y1: out[(Y+d)*w+xx]=0
writepng(f'{sys.path[0]}/score/marked.png', w,h,out)
