#!/usr/bin/env python3
"""Check visible text ink in the actual native setup screenshots."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
qa = root / 'docs/qa' / version
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

    title = bounds((8, 0, 128, 38))
    clock = bounds((128, 0, 193, 38))
    hint = bounds((16, 158, 184, 222))
    instruction = bounds((16, 76, 184, 140))
    center_delta = abs((title[1] + title[3] - clock[1] - clock[3]) / 2)
    assert clock[3] - clock[1] >= 18, (name, clock, 'Clock too small')
    assert clock[0] - title[2] >= 8, (name, title, clock, 'Header collision')
    assert center_delta <= 1.5, (name, center_delta, 'Header optical centers differ')
    assert abs((title[1] + title[3]) / 2 - 19) <= 1.5, (name, title, 'Title not centered')
    assert abs((instruction[1] + instruction[3]) / 2 - 108) <= 1.5, (name, instruction, 'Instruction not centered')
    assert abs((hint[1] + hint[3]) / 2 - 190) <= 1.5, (name, hint, 'Hint not centered')
    assert 228 - hint[3] >= 12, (name, hint, 'Hint too close to the bottom')
    captures.append({'file': source.name,
                     'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                     'titleInk': title, 'clockInk': clock,
                     'headerInkCenterDelta': center_delta,
                     'instructionInk': instruction,
                     'hintInk': hint, 'bottomClearance': 228 - hint[3]})

report = {'result': 'PASS',
          'scope': 'Actual native Screenshot-service pixels, unmodified. '
                   'Visible clock height, title/clock optical centers and hint clearance; '
                   'three clock strings, light/dark and offline setup.',
          'captures': captures}
(qa / 'readability.json').write_text(json.dumps(report, indent=2) + '\n')
print('Native readability PASS:', len(captures), 'screens, 18px clock ink, aligned headers')
