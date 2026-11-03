#!/usr/bin/env python3
"""Isolated Emery QEMU check of ordinary phone-launch rejection, never hardware.

This does not run the plugin phone runtime or simulate a Quick Launch hold.
The portable SDK adapter tests cover the hold/prepare/confirmation path.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import time
import uuid
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pipe-helper', type=Path,
                    default=root.parent / 'recovery-validation/pipe_emulator.py')
parser.add_argument('--output', type=Path, default=root / 'docs/qa/0.1.0/emulator')
args = parser.parse_args()
if not args.pipe_helper.is_file():
    raise SystemExit('Supply the local SDK FIFO emulator helper with --pipe-helper.')
os.environ.setdefault('PEBBLE_QA_STATE', str(root.parent / '.recovery-tools/emulator-open-activity'))
spec = importlib.util.spec_from_file_location('open_activity_pipe_emulator', args.pipe_helper)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

from pebble_tool.commands.install import ToolAppInstaller
from libpebble2.protocol.apps import AppRunState, AppRunStateStart, AppRunStateStop
from libpebble2.services.screenshot import Screenshot
from PIL import Image

package = json.loads((root / 'package.json').read_text())
pbw = root / 'dist' / ('Open-Activity-' + package['version'] + '.pbw')
target = uuid.UUID(package['pebble']['uuid'])
connection = helper.connect()
assert connection.transport.__class__.__name__ == 'PipeTransport'
events = []
def event_received(event):
    if isinstance(event.data, AppRunStateStart):
        events.append({'kind': 'start', 'uuid': str(event.data.uuid)})
    elif isinstance(event.data, AppRunStateStop):
        events.append({'kind': 'stop', 'uuid': str(event.data.uuid)})
connection.register_endpoint(AppRunState, event_received)
ToolAppInstaller(connection, str(pbw), quiet=True).install()
time.sleep(.6)
start = len(events)
connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
deadline = time.monotonic() + 3
while time.monotonic() < deadline:
    observed = events[start:]
    if any(value == {'kind': 'stop', 'uuid': str(target)} for value in observed):
        break
    time.sleep(.05)
else:
    raise AssertionError('Helper did not reject the ordinary phone launch.')
observed = events[start:]
assert any(value == {'kind': 'start', 'uuid': str(target)} for value in observed)
time.sleep(.3)
assert events[-1]['kind'] == 'start' and events[-1]['uuid'] != str(target)
args.output.mkdir(parents=True, exist_ok=True)
image = args.output / 'phone-launch-returned.png'
rows = Screenshot(connection).grab_image()
Image.frombytes('RGB', (200, 228), b''.join(rows)).save(image)
with zipfile.ZipFile(pbw) as archive:
    binary = archive.read('emery/pebble-app.bin')
report = {
    'version': package['version'],
    'scope': 'Real packaged native binary in isolated Emery QEMU; ordinary phone-launch rejection and system return only',
    'phoneRuntime': False, 'physicalWatch': False, 'quickLaunchHoldSimulated': False,
    'pbwSha256': hashlib.sha256(pbw.read_bytes()).hexdigest(),
    'nativeSha256': hashlib.sha256(binary).hexdigest(),
    'events': observed,
    'returnedAppUuid': events[-1]['uuid'],
    'capture': {'file': image.name, 'sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
                'pixels': [200, 228], 'nativePixelsModified': False}
}
(args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
