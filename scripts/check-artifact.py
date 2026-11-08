#!/usr/bin/env python3
"""Check standalone package identity, native limits and license payloads."""
from pathlib import Path
import argparse
from repo_workflow import candidate, check_build
import hashlib
import json
import struct
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text())
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pbw',type=Path,default=candidate(root, 'Open-Activity'))
args=parser.parse_args()
check_build(root,args.pbw)
subprocess.run(['node', str(root / 'scripts/generate-config.cjs'), '--check'], cwd=root, check=True)
pbw = args.pbw
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
    assert all(item['type']!='font' for item in package['pebble']['resources']['media'])
    for key in (b'RESOURCE_ID_GOTHIC_18_BOLD',b'RESOURCE_ID_GOTHIC_24_BOLD',b'RESOURCE_ID_GOTHIC_28_BOLD'):
        assert key in binary,'Missing native OS type profile: '+repr(key)
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
    assert not any(name.endswith('.map') for name in archive.namelist())
    assert 'sourceMappingURL=' not in js
    assert 'presented_activities' in js and 'launch_app' in js
    assert '00000000-0000-0000-0001-000000000007' in js
    assert 'Copyright 2024 Google LLC' in js
    assert archive.read('config.html') == (root / 'config.html').read_bytes()
    plugin = archive.read('plugin.js').decode()
    assert 'sourceMappingURL=' not in plugin
    assert 'registerConfigHandler' in plugin
    assert 'subscribeToSource' not in plugin and 'invokeAction' not in plugin
    for name in ('LICENSE', 'THIRD-PARTY-NOTICES.md', 'licenses/Apache-2.0.txt', 'licenses/OFL-RobotoCondensed.txt'):
        assert archive.read(name) == (root / name).read_bytes()
debug = pbw.with_name('Open-Activity-' + package['version'] + '-debug.zip')
with zipfile.ZipFile(debug) as archive, zipfile.ZipFile(root / 'build' / (root.name + '.pbw')) as sdk:
    manifest = json.loads(archive.read('manifest.json'))
    assert manifest['version'] == package['version'] and manifest['toolVersion'] == '5.46.0'
    for name, runtime in (('pebble-js-app.js', js.encode()), ('plugin.js', plugin.encode())):
        original = sdk.read(name) if name == 'pebble-js-app.js' else (root / 'build/plugin.js').read_bytes()
        assert archive.read('sdk/' + name) == original
        assert archive.read('runtime/' + name) == runtime
        identity = manifest['bundles'][name]
        assert identity['sdkSha256'] == hashlib.sha256(original).hexdigest()
        assert identity['runtimeSha256'] == hashlib.sha256(runtime).hexdigest()
        with tempfile.TemporaryDirectory(prefix='open-activity-minify-check-') as scratch:
            scratch = Path(scratch)
            source, target, target_map = scratch / 'input.js', scratch / name, scratch / (name + '.map')
            source.write_bytes(original)
            args = ['node', str(root / 'scripts/minify-js.cjs'), str(source), str(target), str(target_map)]
            if name == 'pebble-js-app.js':
                original_map = sdk.read(name + '.map')
                assert archive.read('sdk/' + name + '.map') == original_map
                input_map = scratch / 'input.js.map'
                input_map.write_bytes(original_map)
                args.append(str(input_map))
            subprocess.run(args, cwd=root, check=True)
            assert target.read_bytes() == runtime
            assert target_map.read_bytes() == archive.read('runtime/' + name + '.map')
checksum = hashlib.sha256(pbw.read_bytes()).hexdigest()
checksums = dict(line.split('  ', 1)[::-1] for line in (pbw.parent / 'SHA256SUMS.txt').read_text().splitlines())
allowed = {pbw.name, debug.name, 'Open-Activity-' + package['version'] + '-source.zip'}
assert {pbw.name, debug.name}.issubset(checksums) and set(checksums).issubset(allowed)
for name, digest in checksums.items():
    assert digest == hashlib.sha256((pbw.parent / name).read_bytes()).hexdigest()
print(json.dumps({'pbw': str(pbw), 'sha256': checksum, 'nativeFileBytes': len(binary),
                  'nativeLoadedBytes': loaded_bytes, 'nativeVirtualBytes': virtual_bytes,
                  'phoneBundleBytes': len(js.encode()), 'debugArchiveBytes': debug.stat().st_size,
                  'minificationIdentity': 'PASS', 'permissions': ['LaunchApps']}, indent=2))

import subprocess
subprocess.run(["python3",str(root / "scripts/check-localization-fonts.py"),"--pbw",str(pbw)],check=True)
