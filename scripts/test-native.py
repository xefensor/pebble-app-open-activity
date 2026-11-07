#!/usr/bin/env python3
"""Portable native protocol checks; no phone or watch is invoked."""
from pathlib import Path
import json
import os
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='open-activity-test-') as scratch:
    executable = Path(scratch) / 'attempt'
    subprocess.run([
        os.environ.get('CC', 'cc'), '-std=c99', '-I', str(root / 'node_modules'), '-Wall', '-Wextra', '-Werror', '-pedantic',
        str(root / 'src/c/attempt.c'), str(root / 'tests/test_attempt.c'), '-o', str(executable)
    ], check=True)
    subprocess.run([str(executable)], check=True)

with tempfile.TemporaryDirectory(prefix='open-activity-runtime-') as scratch:
    executable = Path(scratch) / 'runtime'
    subprocess.run([
        os.environ.get('CC', 'cc'), '-std=c99', '-I', str(root / 'node_modules'), '-Wall', '-Wextra', '-Werror', '-pedantic',
        '-I', str(root / 'tests/fake-sdk'),
        '-I', str(root / 'node_modules/pebble-xoce-ui/include'),
        str(root / 'src/c/attempt.c'),
        str(root / 'node_modules/pebble-xoce-ui/src/c/layout.c'),
        str(root / 'node_modules/pebble-xoce-ui/src/c/header.c'),
        str(root / 'tests/test_runtime.c'), '-o', str(executable)
    ], check=True)
    subprocess.run([str(executable)], check=True)

package = json.loads((root / 'package.json').read_text())
header = (root / 'src/c/protocol.h').read_text()
phone = (root / 'src/pkjs/protocol.js').read_text()
for name, value in package['pebble']['messageKeys'].items():
    suffix = name.removeprefix('OA_')
    assert re.search(rf'#define OA_KEY_{suffix}\s+{value}\b', header), name
    assert re.search(rf'\b{name}:\s*{value}\b', phone), name
assert package['pebble']['uuid'] in header
assert 'OA_BUDGET_MS 4000u' in header
print('Native/phone/package message keys and timeout agree')
