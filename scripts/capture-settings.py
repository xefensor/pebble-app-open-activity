#!/usr/bin/env python3
"""Render the bundled offline settings HTML with a mock settings bridge.

Uses an installed headless Chromium; no packages or network pages are fetched.
This proves browser layout, not the real Pebble phone WebView integration.
"""
from pathlib import Path
from repo_workflow import candidate as candidate_pbw, qa_output
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser', default=shutil.which('chromium'))
version = json.loads((root / 'package.json').read_text())['version']
parser.add_argument('--output', type=Path, default=qa_output(root, '') / 'settings-layout')
args = parser.parse_args()
if not args.browser:
    raise SystemExit('An installed Chromium is required; specify --browser.')
source = (root / 'config.html').read_text()
shim = """<script>window.Pebble={addEventListener:function(name,fn){document.addEventListener('DOMContentLoaded',function(){fn({target:'plugin'});});},sendMessage:function(target,message){return Promise.resolve({ok:true,settings:{version:1,defaultRole:'primary',holdOverrides:{up:'secondary',down:'primary'}}});}};</script>"""
args.output.mkdir(parents=True, exist_ok=True)
captures = []
with tempfile.TemporaryDirectory(prefix='open-activity-settings-') as scratch:
    scratch = Path(scratch)
    page = scratch / 'settings.html'
    page.write_text(source.replace('<script>', shim + '<script>', 1))
    for width, height in ((320, 1040), (360, 940)):
        image = (args.output / f'settings-{width}.png').resolve()
        subprocess.run([
            args.browser, '--headless', '--no-sandbox', '--disable-gpu',
            '--disable-dev-shm-usage', '--disable-background-networking',
            '--no-first-run', '--no-proxy-server', '--disable-extensions',
            '--hide-scrollbars', '--virtual-time-budget=1000',
            f'--screenshot={image}', f'--window-size={width},{height}',
            f'--user-data-dir={scratch / str(width)}', page.as_uri()
        ], check=True, timeout=20)
        captures.append({'file': image.name, 'pixels': [width, height],
                         'sha256': hashlib.sha256(image.read_bytes()).hexdigest()})
report = {
    'scope': 'Actual offline config.html rendered in Chromium with a mock ready/settings bridge; not a phone WebView or SDK runtime',
    'browser': subprocess.check_output([args.browser, '--version'], text=True).strip(),
    'configHtmlSha256': hashlib.sha256(source.encode()).hexdigest(),
    'mockSettings': {'version': 1, 'defaultRole': 'primary',
                     'holdOverrides': {'up': 'secondary', 'down': 'primary'}},
    'captures': captures
}
(args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
