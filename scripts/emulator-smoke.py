#!/usr/bin/env python3
"""Isolated Emery QEMU check of the native setup screen, never hardware.

This does not run the plugin phone runtime or simulate a Quick Launch hold.
The portable SDK adapter tests cover the hold/prepare/confirmation path.
"""
from pathlib import Path
from repo_workflow import candidate as candidate_pbw, qa_output
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
parser.add_argument('--output', type=Path, default=qa_output(root, '') / 'emulator')
parser.add_argument('--expected-sha256', help='Require the exact candidate PBW bytes')
parser.add_argument('--pbw',type=Path,help='Explicitly separate lookup/launch-reason fixture')
parser.add_argument('--native-sizes',action='store_true',help='Relaunch after each actual OS content-size setting')
parser.add_argument('--opening-fixture',action='store_true',help='Explicit Quick Launch reason override fixture, not an actual OS gesture')
parser.add_argument('--repeat-cycles',type=int,default=0,help='Additional ordinary open/Back cleanup cycles')
parser.add_argument('--composition-only', action='store_true', help='Capture light/dark composition without claiming full workflow QA')
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
from libpebble2.protocol.logs import AppLogMessage,AppLogShippingControl
from libpebble2.communication.transports.qemu.protocol import QemuButton, QemuBluetoothConnection, QemuContentSize, QemuTimeFormat
from pebble_tool.commands.emucontrol import send_data_to_qemu
from libpebble2.services.appmessage import AppMessageService, Uint8
from libpebble2.services.screenshot import Screenshot
from PIL import Image

pbw = args.pbw or candidate_pbw(root, 'Open-Activity')
if args.expected_sha256 and hashlib.sha256(pbw.read_bytes()).hexdigest() != args.expected_sha256:
    raise AssertionError('Candidate PBW bytes changed before native setup QA')
target = uuid.UUID(package['pebble']['uuid'])
connection = helper.connect()
assert connection.transport.__class__.__name__ == 'PipeTransport'
events = []
native_logs=[]
connection.register_endpoint(AppLogMessage,lambda packet:native_logs.append(packet.message))
connection.send_packet(AppLogShippingControl(enable=True))
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
    time.sleep(.25)
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

if args.opening_fixture:
    assert args.pbw,'Opening launch reason must be an explicit separate fixture'
    for size,label in enumerate(('small','medium','large'),1):
        send_data_to_qemu(connection.transport,QemuContentSize(size=size))
        send_data_to_qemu(connection.transport,QemuBluetoothConnection(connected=True))
        time.sleep(.2)
        started=time.monotonic()
        connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
        await_foreground(True);capture(label+'-opening')
        await_foreground(False)
        elapsed=time.monotonic()-started
        assert elapsed<5.5,elapsed
    assert len(native_messages)==3 and all(data.get(2000)==6 for data in native_messages),native_messages
    (args.output/'report.json').write_text(json.dumps({
        'scope':'Packaged native opening composition and timeout, using a launch-reason override fixture; no actual OS Quick Launch gesture or phone runtime',
        'pbwSha256':hashlib.sha256(pbw.read_bytes()).hexdigest(),'captures':captures,
        'actualOsContentSizes':[1,2,3],'physicalWatch':False,'quickLaunchHoldSimulated':False,
        'checks':{'nativeOpeningAtAllOsSizes':True,'timeoutCloses':True,'onlyBestEffortCancelWithoutPhoneRequest':True}
    },indent=2)+'\n')
    print('Opening fixture sizes/timeout PASS:',args.output)
    raise SystemExit(0)

send_data_to_qemu(connection.transport, QemuBluetoothConnection(connected=True))
connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
await_foreground(True)
capture('setup-phone-launch')
if args.composition_only:
    appmessages.send_message(target,{2000:Uint8(7),2008:Uint8(1)})
    time.sleep(.3)
    capture('setup-dark')
    (args.output / 'composition.json').write_text(json.dumps({
        'scope':'Early whole-screen composition captures only; not workflow verification',
        'version':package['version'],'pbwSha256':hashlib.sha256(pbw.read_bytes()).hexdigest(),
        'captures':captures,'physicalWatch':False
    },indent=2)+'\n')
    print('Light/dark composition captured:',args.output)
    raise SystemExit(0)
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
if args.native_sizes:
    for size,label in enumerate(('small','medium','large'),1):
        send_data_to_qemu(connection.transport,QemuContentSize(size=size))
        send_data_to_qemu(connection.transport,QemuBluetoothConnection(connected=True))
        time.sleep(.2)
        connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
        await_foreground(True)
        for dark in (0,1):
            appmessages.send_message(target,{2000:Uint8(7),2008:Uint8(dark)})
            time.sleep(.2)
            capture(label+('-dark' if dark else '-light')+'-setup-top')
            for _ in range(10):
                send_data_to_qemu(connection.transport,QemuButton(state=int(QemuButton.Button.Down)))
                time.sleep(.08);send_data_to_qemu(connection.transport,QemuButton(state=0));time.sleep(.08)
            capture(label+('-dark' if dark else '-light')+'-setup-bottom')
            for _ in range(10):
                send_data_to_qemu(connection.transport,QemuButton(state=int(QemuButton.Button.Up)))
                time.sleep(.08);send_data_to_qemu(connection.transport,QemuButton(state=0));time.sleep(.08)
        back()
        for style in (False,True):
            send_data_to_qemu(connection.transport,QemuTimeFormat(is_24_hour=style))
            stamp=int(datetime(2026,11,7,22,58,tzinfo=timezone.utc).timestamp())
            connection.send_packet(TimeMessage(message=SetUTC(unix_time=stamp,utc_offset=0,tz_name='UTC')))
            time.sleep(.2)
            connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
            await_foreground(True);capture(label+('-24h' if style else '-12h')+'-clock');back()
    assert not native_messages,'Size/scroll/clock tests must never initiate activity navigation'
for _ in range(args.repeat_cycles):
    connection.send_packet(AppRunState(data=AppRunStateStart(uuid=target)))
    await_foreground(True);time.sleep(.08);back()
time.sleep(.3)
if args.repeat_cycles:
    cleanup=[line for line in native_logs if 'Still allocated' in line]
    assert len(cleanup)>=args.repeat_cycles and all('Still allocated <0B>' in line for line in cleanup),cleanup
with zipfile.ZipFile(pbw) as archive:
    binary = archive.read('emery/pebble-app.bin')
report = {
    'version': package['version'],
    'scope': 'Real packaged native binary in isolated Emery QEMU; ordinary phone-launch setup, duration beyond four seconds, light/dark appearance delivery, cold dark reopening before phone data, invalid theme rejection, offline setup and Back. Menu launch reasons and Quick Launch gestures are checked separately by the portable native SDK adapter.',
    'phoneRuntime': False, 'physicalWatch': False, 'quickLaunchHoldSimulated': False,
    'lookupOrReasonFixture':bool(args.pbw),'actualOsContentSizes':[1,2,3] if args.native_sizes else None,
    'repeatCycles':args.repeat_cycles,'nativeLogs':native_logs,
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
