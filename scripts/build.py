#!/usr/bin/env python3
"""Build a standalone permissions-enabled Open Activity PBW with notices."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
package = json.loads((root / 'package.json').read_text())
subprocess.run(['pebble', 'clean'], cwd=root, check=True)
subprocess.run(['python3', str(root / 'scripts/bundle-plugin.py'), str(root / 'build/plugin.js')], cwd=root, check=True)
subprocess.run(['pebble', 'build'], cwd=root, check=True)
source_pbw = root / 'build' / (root.name + '.pbw')
with zipfile.ZipFile(source_pbw) as source:
    entries = {name: source.read(name) for name in source.namelist()}
appinfo = json.loads(entries['appinfo.json'])
appinfo['manifestVersion'] = 2
appinfo['usesPermissions'] = package['pebble']['usesPermissions']
appinfo['configPage'] = package['pebble']['configPage']
appinfo['plugin'] = package['pebble']['plugin']
entries['appinfo.json'] = json.dumps(appinfo, indent=2).encode()
entries['config.html'] = (root / 'config.html').read_bytes()
entries['plugin.js'] = (root / 'build/plugin.js').read_bytes()
for name in ('LICENSE', 'THIRD-PARTY-NOTICES.md', 'licenses/Apache-2.0.txt'):
    entries[name] = (root / name).read_bytes()
destination = root / 'dist' / ('Open-Activity-' + package['version'] + '.pbw')
destination.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as output:
    for name, content in sorted(entries.items()):
        entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        output.writestr(entry, content)
checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
(destination.parent / 'SHA256SUMS.txt').write_text(checksum + '  ' + destination.name + '\n')
subprocess.run(['python3', str(root / 'scripts/check-artifact.py')], cwd=root, check=True)
subprocess.run(['node', '--test', str(root / 'tests/package.test.js')], cwd=root, check=True)
print(destination)
