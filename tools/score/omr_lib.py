import zlib, struct
def readpng(p):
    d=open(p,'rb').read(); i=8; w=h=None; idat=b''
    while i<len(d):
        ln=struct.unpack('>I', d[i:i+4])[0]; t=d[i+4:i+8]; body=d[i+8:i+8+ln]
        if t==b'IHDR': w,h=struct.unpack('>II', body[:8])
        elif t==b'IDAT': idat+=body
        i+=12+ln
    raw=zlib.decompress(idat); out=bytearray(w*h); prev=bytearray(w); pos=0
    for y in range(h):
        f=raw[pos]; pos+=1; line=bytearray(raw[pos:pos+w]); pos+=w
        if f==1:
            for x in range(1,w): line[x]=(line[x]+line[x-1])&255
        elif f==2:
            for x in range(w): line[x]=(line[x]+prev[x])&255
        elif f==3:
            for x in range(w): line[x]=(line[x]+((line[x-1] if x else 0)+prev[x])//2)&255
        elif f==4:
            for x in range(w):
                a=line[x-1] if x else 0; b=prev[x]; c=prev[x-1] if x else 0
                pa,pb,pc=abs(b-c),abs(a-c),abs(a+b-2*c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out[y*w:(y+1)*w]=line; prev=line
    return w,h,out
def writepng(p,w,h,g):
    rows=b''.join(b'\x00'+bytes(g[y*w:(y+1)*w]) for y in range(h))
    def ch(t,pl): return struct.pack('>I',len(pl))+t+pl+struct.pack('>I', zlib.crc32(t+pl)&0xffffffff)
    open(p,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,0,0,0,0))
        +ch(b'IDAT', zlib.compress(rows,6))+ch(b'IEND',b''))
