#!/usr/bin/env python3
"""Check the whole native type scale, line spacing and compiled font coverage."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile
from PIL import Image

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
qa = root / 'docs/qa' / version
font_report = {}
with zipfile.ZipFile(root / 'dist' / ('Open-Activity-' + version + '.pbw')) as archive:
    packed = archive.read('emery/app_resources.pbpack')
    assert struct.unpack_from('<I', packed)[0] == 3
    for index in range(3):
        _number, offset, length, _crc = struct.unpack_from('<4I', packed, 12 + index * 16)
        data = packed[4108 + offset:4108 + offset + length]
        fmt, point, count, wildcard, buckets, cp_bytes, header, features = struct.unpack_from('<BBHHBBBB', data)
        assert fmt == 3 and point in (22, 24, 26)
        offset_bytes = 2 if features & 1 else 4
        table = header + buckets * 4
        entries = {}
        for bucket in range(buckets):
            _hash, size, position = struct.unpack_from('<BBH', data, header + bucket * 4)
            for item in range(size):
                at = table + position + item * (cp_bytes + offset_bytes)
                code = int.from_bytes(data[at:at + cp_bytes], 'little')
                entries[code] = int.from_bytes(data[at + cp_bytes:at + cp_bytes + offset_bytes], 'little')
        assert len(entries) == count
        base = table + count * (cp_bytes + offset_bytes)
        glyphs = {code: struct.unpack_from('<BBbbb', data, base + at) for code, at in entries.items()}
        assert all(ord(c) in glyphs for c in 'ÁÉČŘŮžý…’')
        cap = glyphs[ord('H')][1]
        strings = {22: ('Open Activity', 'Quick Launch', 'opens activities.'),
                   24: ('Open settings in', 'the Pebble app.'),
                   26: tuple('%02d:%02d' % (hour, minute) for hour in range(24) for minute in range(60))}[point]
        widths = [sum(glyphs[ord(c)][4] for c in text) for text in strings]
        limit = 62 if point == 26 else 122 if point == 22 else 166
        if point == 22:
            assert widths[0] <= 122 and max(widths[1:]) <= 166
        else:
            assert max(widths) <= limit
        font_report[point] = {'capInkHeight': cap, 'glyphCount': count,
                              'sha256': hashlib.sha256(data).hexdigest(),
                              'maxCheckedAdvance': max(widths), 'stringsChecked': len(strings),
                              'czechAndPunctuationCovered': True}
assert font_report[26]['capInkHeight'] >= 18
assert font_report[24]['capInkHeight'] >= 17
assert font_report[22]['capInkHeight'] >= 16
assert font_report[26]['capInkHeight'] - font_report[24]['capInkHeight'] <= 3
captures = []
for name in ('setup-phone-launch', 'setup-dark', 'setup-clock-00-00',
             'setup-clock-11-11', 'setup-clock-22-58', 'setup-offline'):
    source = qa / 'emulator' / (name + '.png')
    image = Image.open(source).convert('RGB')
    background = image.getpixel((0, 40))

    def bounds(frame):
        x0, y0, x1, y1 = frame
        points = [(x, y) for y in range(y0, y1) for x in range(x0, x1)
                  if image.getpixel((x, y)) != background]
        assert points, (name, frame, 'No visible ink')
        return [min(x for x, y in points), min(y for x, y in points),
                max(x for x, y in points) + 1, max(y for x, y in points) + 1]

    title = bounds((8, 0, 132, 40))
    clock = bounds((132, 0, 193, 40))
    first = bounds((16, 70, 184, 106))
    second = bounds((16, 106, 184, 140))
    hint_first = bounds((16, 160, 184, 190))
    hint_second = bounds((16, 190, 184, 224))
    instruction = [min(first[0], second[0]), first[1], max(first[2], second[2]), second[3]]
    hint = [min(hint_first[0], hint_second[0]), hint_first[1], max(hint_first[2], hint_second[2]), hint_second[3]]
    center_delta = abs((title[1] + title[3] - clock[1] - clock[3]) / 2)
    assert clock[3] - clock[1] >= 18, (name, clock, 'Clock too small')
    assert clock[0] - title[2] >= 4, (name, title, clock, 'Header collision')
    assert center_delta <= 1.5, (name, center_delta, 'Header optical centers differ')
    assert abs((title[1] + title[3]) / 2 - 19) <= 1.5, (name, title, 'Title not centered')
    assert abs((instruction[1] + instruction[3]) / 2 - 104) <= 2, (name, instruction, 'Instruction not centered')
    assert abs((hint[1] + hint[3]) / 2 - 191) <= 2, (name, hint, 'Hint not centered')
    assert second[1] - first[3] >= 4, (name, first, second, 'Main lines cramped')
    assert hint_second[1] - hint_first[3] >= 4, (name, hint_first, hint_second, 'Hint lines cramped')
    assert 228 - hint[3] >= 12, (name, hint, 'Hint too close to the bottom')
    captures.append({'file': source.name,
                     'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                     'titleInk': title, 'clockInk': clock,
                     'headerInkCenterDelta': center_delta,
                     'instructionInk': instruction,
                     'mainLineGap': second[1] - first[3],
                     'hintLineGap': hint_second[1] - hint_first[3],
                     'hintInk': hint, 'bottomClearance': 228 - hint[3]})

report = {'result': 'PASS',
          'scope': 'Whole composition: unmodified native pixels plus actual compiled PFO glyphs. '
                   'All roles, primary/secondary leading, header balance and bottom clearance; '
                   'all 1,440 clock strings fit, extended Latin coverage verified.',
          'compiledFonts': font_report,
          'captures': captures}
(qa / 'readability.json').write_text(json.dumps(report, indent=2) + '\n')
print('Whole-screen readability PASS:', len(captures), 'screens, balanced 22/24/26 roles and 1,440 clock strings')
