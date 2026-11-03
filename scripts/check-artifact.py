#!/usr/bin/env python3
"""Check standalone package identity, native limits and license payloads."""
from pathlib import Path
import hashlib
import json
import struct
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text())
subprocess.run(['node', str(root / 'scripts/generate-config.cjs'), '--check'], cwd=root, check=True)
pbw = root / 'dist' / ('Open-Activity-' + package['version'] + '.pbw')
with zipfile.ZipFile(pbw) as archive:
    appinfo = json.loads(archive.read('appinfo.json'))
    assert appinfo['uuid'] == package['pebble']['uuid']
    assert appinfo['versionLabel'] == package['version']
    assert appinfo['shortName'] == 'Open Activity'
    assert appinfo['manifestVersion'] == 2
    assert appinfo['usesPermissions'] == ['LaunchApps']
    assert appinfo['configPage'] == 'config.html'
    assert appinfo['plugin'] == package['pebble']['plugin']
    assert appinfo['plugin']['sources'] == [] and appinfo['plugin']['actions'] == []
    assert appinfo['watchapp']['watchface'] is False
    assert appinfo['appKeys'] == package['pebble']['messageKeys']
    assert set(appinfo['targetPlatforms']) == {'emery'}
    binary = archive.read('emery/pebble-app.bin')
    assert binary[:8] == b'PBLAPP\x00\x00'
    elf = (root / 'build/emery/pebble-app.elf').read_bytes()
    assert elf[:6] == b'\x7fELF\x01\x01'
    table = struct.unpack_from('<I', elf, 32)[0]
    width, count = struct.unpack_from('<HH', elf, 46)
    sections = [struct.unpack_from('<10I', elf, table + index * width) for index in range(count)]
    allocated = [section for section in sections if section[2] & 2 and section[5]]
    loaded = [section for section in allocated if section[1] != 8]
    loaded_bytes = max(section[3] + section[5] for section in loaded)
    virtual_bytes = max(section[3] + section[5] for section in allocated)
    assert loaded_bytes <= 65535 and virtual_bytes <= 65535
    assert struct.unpack_from('<H', binary, 14)[0] == loaded_bytes
    assert struct.unpack_from('<H', binary, 128)[0] == virtual_bytes
    relocations = struct.unpack_from('<I', binary, 100)[0]
    assert len(binary) == loaded_bytes + 4 * relocations
    js = archive.read('pebble-js-app.js').decode()
    assert 'presented_activities' in js and 'launch_app' in js
    assert '00000000-0000-0000-0001-000000000007' in js
    assert 'Copyright 2024 Google LLC' in js
    assert archive.read('config.html') == (root / 'config.html').read_bytes()
    plugin = archive.read('plugin.js').decode()
    assert 'registerConfigHandler' in plugin
    assert 'subscribeToSource' not in plugin and 'invokeAction' not in plugin
    for name in ('LICENSE', 'THIRD-PARTY-NOTICES.md', 'licenses/Apache-2.0.txt'):
        assert archive.read(name) == (root / name).read_bytes()
checksum = hashlib.sha256(pbw.read_bytes()).hexdigest()
assert (root / 'dist/SHA256SUMS.txt').read_text() == checksum + '  ' + pbw.name + '\n'
print(json.dumps({'pbw': str(pbw), 'sha256': checksum, 'nativeFileBytes': len(binary),
                  'nativeLoadedBytes': loaded_bytes, 'nativeVirtualBytes': virtual_bytes,
                  'phoneBundleBytes': len(js.encode()), 'permissions': ['LaunchApps']}, indent=2))
