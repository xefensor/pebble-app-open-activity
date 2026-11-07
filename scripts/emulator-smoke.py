#!/usr/bin/env python3
"""Isolated Emery QEMU check of the native setup screen, never hardware.

This does not run the plugin phone runtime or simulate a Quick Launch hold.
The portable SDK adapter tests cover the hold/prepare/confirmation path.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import os
import tempfile
import time
import uuid
import zipfile
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pipe-helper', type=Path,
                    default=root.parent / 'recovery-validation/pipe_emulator.py')
parser.add_argument('--output', type=Path, default=root / 'docs/qa' / package['version'] / 'emulator')
parser.add_argument('--expected-sha256', help='Require the exact candidate PBW bytes')
args = parser.parse_args()
if not args.pipe_helper.is_file():
    raise SystemExit('Supply the local SDK FIFO emulator helper with --pipe-helper.')
os.environ.setdefault('PEBBLE_QA_STATE', tempfile.mkdtemp(prefix='open-activity-setup-'))
spec = importlib.util.spec_from_file_location('open_activity_pipe_emulator', args.pipe_helper)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

from pebble_tool.commands.install import ToolAppInstaller
from libpebble2.protocol.apps import AppRunState, AppRunStateStart, AppRunStateStop, AppRunStateRequest
from libpebble2.protocol.system import TimeMessage, SetUTC
from libpebble2.communication.transports.qemu.protocol import QemuButton, QemuBluetoothConnection
from pebble_tool.commands.emucontrol import send_data_to_qemu
from libpebble2.services.appmessage import AppMessageService, Uint8
from libpebble2.services.screenshot import Screenshot
from PIL import Image

pbw = root / 'dist' / ('Open-Activity-' + package['version'] + '.pbw')
if args.expected_sha256 and hashlib.sha256(pbw.read_bytes()).hexdigest() != args.expected_sha256:
    raise AssertionError('Candidate PBW bytes changed before native setup QA')
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
native_messages = []
appmessages = AppMessageService(connection)
appmessages.register_handler('appmessage', lambda _tid, app, data: native_messages.append(data) if app == target else None)
ToolAppInstaller(connection, str(pbw), quiet=True).install()
time.sleep(.6)
start = len(events)
args.output.mkdir(parents=True, exist_ok=True)
captures = []
def foreground():
    return getattr(connection.send_and_read(AppRunState(data=AppRunStateRequest()), AppRunState).data, 'uuid', None)
def await_foreground(expected):
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        if (foreground() == target) == expected:
            return
        time.sleep(.1)
    raise AssertionError('Native setup foreground did not settle')
def capture(name):
    image = args.output / (name + '.png')
    rows = Screenshot(connection).grab_image()
    Image.frombytes('RGB', (200, 228), b''.join(rows)).save(image)
    captures.append({'file': image.name, 'sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
                     'pixels': [200, 228], 'nativePixelsModified': False})
def back():
    send_data_to_qemu(connection.transport, QemuButton(state=int(QemuButton.Button.Back)))
    time.sleep(.12)
    send_data_to_qemu(connection.transport, QemuButton(state=0))
    await_foreground(False)

send_data_to_qemu(connection.transport, QemuBluetoothConnection(connected=True))
connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
await_foreground(True)
capture('setup-phone-launch')
time.sleep(5.2)
assert foreground() == target, 'Normal setup must outlive the Quick Launch budget'
capture('setup-still-open-after-budget')
appmessages.send_message(target,{2000:Uint8(7),2008:Uint8(1)})
time.sleep(.3)
capture('setup-dark')
back()
connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
await_foreground(True)
capture('setup-dark-restored-before-phone')
appmessages.send_message(target,{2000:Uint8(7),2008:Uint8(2)})
time.sleep(.2)
capture('setup-invalid-theme-keeps-dark')
back()
capture('setup-back-returned')
for hour, minute, label in ((0, 0, '00-00'), (11, 11, '11-11'), (22, 58, '22-58')):
    stamp = int(datetime(2026, 11, 7, hour, minute, tzinfo=timezone.utc).timestamp())
    connection.send_packet(TimeMessage(message=SetUTC(unix_time=stamp, utc_offset=0, tz_name='UTC')))
    time.sleep(.2)
    connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
    await_foreground(True)
    capture('setup-clock-' + label)
    back()
send_data_to_qemu(connection.transport, QemuBluetoothConnection(connected=False))
connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
await_foreground(True)
time.sleep(5.2)
assert foreground() == target, 'Offline setup must stay open'
capture('setup-offline')
back()
assert not native_messages, 'Setup must not emit a native activity handshake'
with zipfile.ZipFile(pbw) as archive:
    binary = archive.read('emery/pebble-app.bin')
report = {
    'version': package['version'],
    'scope': 'Real packaged native binary in isolated Emery QEMU; ordinary phone-launch setup, duration beyond four seconds, light/dark appearance delivery, cold dark reopening before phone data, invalid theme rejection, offline setup and Back. Menu launch reasons and Quick Launch gestures are checked separately by the portable native SDK adapter.',
    'phoneRuntime': False, 'physicalWatch': False, 'quickLaunchHoldSimulated': False,
    'pbwSha256': hashlib.sha256(pbw.read_bytes()).hexdigest(),
    'nativeSha256': hashlib.sha256(binary).hexdigest(),
    'events': events[start:],
    'checks': {'ordinarySetupStaysOpen': True, 'outlivesQuickLaunchBudget': True,
               'offlineSetupStaysOpen': True, 'backReturns': True, 'noNativeHandshake': True,
               'themeUpdatesInPassiveSetup': True, 'darkRestoredBeforePhone': True, 'invalidThemeIgnored': True},
    'captures': captures
}
(args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
