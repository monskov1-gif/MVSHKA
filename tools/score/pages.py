import re, zlib, struct
F='/root/.claude/uploads/4d7ee2a2-8e77-572e-9f4d-652736e06d10/1e111543-Gliere_prelude_Op.43_No.1.pdf'
OUT='/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad/score'
d=open(F,'rb').read()
occ={}
for m in re.finditer(rb'(\d+) 0 obj', d): occ.setdefault(int(m.group(1)),[]).append(m.end())
def seg(n, k=0):
    i=occ[n][k]; return d[i:d.find(b'endobj', i)]
def stream(n, k=0):
    s=seg(n,k); st=s.find(b'stream')
    if st<0: return None
    m=re.search(rb'/Length (\d+)', s)
    body=s[st+6:].lstrip(b'\r\n')
    if m: body=body[:int(m.group(1))]
    try: return zlib.decompress(body)
    except Exception: return body

def palette(csnum):
    t=seg(csnum)
    m=re.search(rb'\[/Indexed (\d+) 0 R (\d+) (\d+) 0 R\]', t)
    if not m: return None
    lut=stream(int(m.group(3)))
    n=len(lut)//3
    return bytes((lut[i*3]*299+lut[i*3+1]*587+lut[i*3+2]*114)//1000 for i in range(n))

def image(n):
    s=seg(n)
    if b'/Image' not in s: return None
    w=int(re.search(rb'/Width (\d+)', s).group(1))
    h=int(re.search(rb'/Height (\d+)', s).group(1))
    csm=re.search(rb'/ColorSpace (\d+) 0 R', s)
    data=stream(n)
    if csm:
        pal=palette(int(csm.group(1)))
        if pal: data=bytes(pal[b] if b<len(pal) else 255 for b in data)
    return w,h,data

def png(path, w, h, gray):
    rows=b''.join(b'\x00'+bytes(gray[y*w:(y+1)*w]) for y in range(h))
    def ch(t,p): return struct.pack('>I',len(p))+t+p+struct.pack('>I', zlib.crc32(t+p)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR', struct.pack('>IIBBBBB',w,h,8,0,0,0,0))
        +ch(b'IDAT', zlib.compress(rows,6))+ch(b'IEND', b''))

PAGES=[(220,221,258),(1,2,3),(72,73,74)]
SCALE=2.2                                   # пикселей на пункт PDF
for pi,(pg,res,cont) in enumerate(PAGES, 1):
    rs=seg(res)
    xo={}
    xm=re.search(rb'/XObject\s*<<(.*?)>>', rs, re.S)
    if xm:
        for nm, num in re.findall(rb'/(\w+)\s+(\d+)\s+0\s+R', xm.group(1)):
            xo[nm.decode()]=int(num)
    cs=stream(cont)
    PW, PH = 595, 842
    W, H = int(PW*SCALE), int(PH*SCALE)
    canvas=bytearray(b'\xff'*(W*H))
    placed=0
    for m in re.finditer(rb'([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+) cm\s*/(\w+) Do', cs):
        a,b_,c,dd,e,f = [float(x) for x in m.groups()[:6]]
        name=m.group(7).decode()
        if name not in xo: continue
        im=image(xo[name])
        if not im: continue
        iw,ih,data=im
        # прямоугольник в пунктах -> в пикселях, начало координат снизу слева
        x0=int(e*SCALE); y0=int((PH-(f+dd))*SCALE)
        bw=max(1,int(a*SCALE)); bh=max(1,int(dd*SCALE))
        for yy in range(bh):
            sy=min(ih-1, yy*ih//bh)
            ty=y0+yy
            if ty<0 or ty>=H: continue
            row=data[sy*iw:(sy+1)*iw]
            base=ty*W
            for xx in range(bw):
                tx=x0+xx
                if 0<=tx<W:
                    v=row[min(iw-1, xx*iw//bw)]
                    if v<canvas[base+tx]: canvas[base+tx]=v
        placed+=1
    png(f'{OUT}/p{pi}.png', W, H, canvas)
    print('страница', pi, '— картинок', placed, f'{W}x{H}')
