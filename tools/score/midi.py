import struct, sys, json
F=sys.argv[1] if len(sys.argv)>1 else '/root/.claude/uploads/4d7ee2a2-8e77-572e-9f4d-652736e06d10/9f26415a-Free-scores.com_glin-reinhold-prelude-204768.midi'
d=open(F,'rb').read()
assert d[:4]==b'MThd', d[:4]
hl=struct.unpack('>I', d[4:8])[0]
fmt, ntrk, div = struct.unpack('>HHH', d[8:8+6])
print('формат', fmt, '· дорожек', ntrk, '· тиков на четверть', div)
pos=8+hl
def vlq(i):
    v=0
    while True:
        b=d[i]; i+=1; v=(v<<7)|(b&0x7f)
        if not (b&0x80): return v,i
notes=[]; tempos=[]; tsig=[]
for t in range(ntrk):
    assert d[pos:pos+4]==b'MTrk', (t, d[pos:pos+4])
    ln=struct.unpack('>I', d[pos+4:pos+8])[0]
    i=pos+8; end=i+ln; tick=0; run=None
    on={}
    while i < end:
        dt,i = vlq(i); tick += dt
        b=d[i]
        if b & 0x80: st=b; i+=1; run=st
        else: st=run
        ev=st & 0xf0; ch=st & 0x0f
        if ev in (0x80,0x90):
            n=d[i]; v=d[i+1]; i+=2
            if ev==0x90 and v>0: on.setdefault((ch,n),[]).append((tick,v))
            else:
                k=(ch,n)
                if on.get(k):
                    s,vv=on[k].pop(0)
                    notes.append({'t':s,'d':tick-s,'n':n,'v':vv,'ch':ch,'trk':t})
        elif ev in (0xA0,0xB0,0xE0): i+=2
        elif ev in (0xC0,0xD0): i+=1
        elif st==0xFF:
            mt=d[i]; i+=1; L,i=vlq(i); data=d[i:i+L]; i+=L
            if mt==0x51: tempos.append((tick, struct.unpack('>I', b'\x00'+data)[0]))
            elif mt==0x58: tsig.append((tick, data[0], 2**data[1], data[2], data[3]))
            elif mt==0x59: print('знаки при ключе:', struct.unpack('b', data[:1])[0], 'минор' if data[1] else 'мажор')
        elif st in (0xF0,0xF7):
            L,i=vlq(i); i+=L
        else:
            print('неизвестный байт', hex(st), 'на', i); break
    pos=end
notes.sort(key=lambda x:(x['t'], x['n']))
print('нот', len(notes), '· темпы', [(t, round(60_000_000/u)) for t,u in tempos][:6])
print('размер', tsig[:3])
print('диапазон тиков', notes[0]['t'], '..', max(n['t']+n['d'] for n in notes))
json.dump({'div':div,'tempos':tempos,'tsig':tsig,'notes':notes}, open(f'{sys.path[0] if False else "/tmp/claude-0/-home-user-MVSHKA/4d7ee2a2-8e77-572e-9f4d-652736e06d10/scratchpad"}/gliere.json','w'))
