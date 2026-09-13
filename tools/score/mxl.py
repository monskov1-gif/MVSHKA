# -*- coding: utf-8 -*-
"""MusicXML (.mxl / .xml) -> тот же JSON, что делает midi.py.

Нужен, чтобы midi2track.py и midi2perf.py могли есть партитуры, а не
только MIDI. MusicXML точнее: в нём есть тональность, размер, реальные
длительности и лиги, а не только события клавиш.

    python3 mxl.py файл.mxl out.json
"""
import sys, json, zipfile, os
import xml.etree.ElementTree as ET

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'score.json'

def load(path):
    if path.endswith('.mxl') or zipfile.is_zipfile(path):
        z = zipfile.ZipFile(path)
        names = [n for n in z.namelist() if n.endswith(('.xml', '.musicxml')) and not n.startswith('META-INF')]
        return ET.fromstring(z.read(names[0]))
    return ET.parse(path).getroot()

root = load(SRC)
STEP = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
DIV_OUT = 480                                    # приводим к делителю MIDI

notes, tempos, tsig, keys = [], [], [], []
for pi, part in enumerate(root.findall('part')):
    div = 1; t = 0                               # t — тики внутри партии
    beats, beat_type = 4, 4
    ties = {}                                    # (высота) -> индекс ноты под лигой
    for m_i, meas in enumerate(part.findall('measure')):
        at = meas.find('attributes')
        if at is not None:
            d = at.find('divisions')
            if d is not None: div = int(d.text)
            k = at.find('key/fifths')
            if k is not None and pi == 0: keys.append((t, int(k.text)))
            tm = at.find('time')
            if tm is not None:
                beats = int(tm.find('beats').text); beat_type = int(tm.find('beat-type').text)
                if pi == 0: tsig.append((round(t*DIV_OUT/div), beats, beat_type, 24, 8))
        for s in meas.iter('sound'):
            if s.get('tempo') and pi == 0: tempos.append((round(t*DIV_OUT/div), round(60_000_000/float(s.get('tempo')))))
        for el in meas:
            if el.tag == 'backup': t -= int(el.find('duration').text); continue
            if el.tag == 'forward': t += int(el.find('duration').text); continue
            if el.tag != 'note': continue
            dur_e = el.find('duration')
            dur = int(dur_e.text) if dur_e is not None else 0
            if el.find('rest') is not None: t += dur; continue
            p = el.find('pitch')
            if p is None: t += dur; continue
            midi = 12*(int(p.find('octave').text)+1) + STEP[p.find('step').text]
            alt = p.find('alter')
            if alt is not None: midi += int(float(alt.text))
            chord = el.find('chord') is not None
            start = t if not chord else t - 0  # аккордовые ноты начинаются там же
            if chord: start = notes[-1]['_raw'] if notes else t
            tie_stop  = any(x.get('type') == 'stop'  for x in el.findall('tie'))
            tie_start = any(x.get('type') == 'start' for x in el.findall('tie'))
            if tie_stop and midi in ties:            # продлеваем начатую ноту
                notes[ties[midi]]['d'] += round(dur*DIV_OUT/div)
                if not tie_start: ties.pop(midi, None)
            else:
                dyn = el.find('.//dynamics')
                notes.append({'t': round(start*DIV_OUT/div), 'd': round(dur*DIV_OUT/div),
                              'n': midi, 'v': 72, 'ch': pi, 'trk': pi, '_raw': start})
                if tie_start: ties[midi] = len(notes)-1
            if not chord: t += dur
for n in notes: n.pop('_raw', None)
notes.sort(key=lambda n: (n['t'], n['n']))
print('партий', len(root.findall('part')), '· нот', len(notes),
      '· знаки при ключе', keys[0][1] if keys else '—',
      '· размер', f'{tsig[0][1]}/{tsig[0][2]}' if tsig else '—',
      '· темп', round(60_000_000/tempos[0][1]) if tempos else '—')
if notes:
    last = max(n['t']+n['d'] for n in notes)
    print('тактов примерно', round(last/ (DIV_OUT*(tsig[0][1] if tsig else 4))))
json.dump({'div':DIV_OUT,'tempos':tempos,'tsig':tsig,'pedal':[],'notes':notes}, open(OUT,'w'))
print('записано в', OUT)
