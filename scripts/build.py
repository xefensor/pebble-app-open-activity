#!/usr/bin/env python3
"""Build a standalone permissions-enabled Open Activity PBW with notices."""

from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
from repo_workflow import build_output

output_directory = build_output(root, "Open-Activity")
package = json.loads((root / "package.json").read_text())
subprocess.run(["python3", str(root / "scripts/generate-localization.py")], cwd=root, check=True)
subprocess.run(["node", str(root / "scripts/generate-config.cjs")], cwd=root, check=True)
subprocess.run(["pebble", "clean"], cwd=root, check=True)
subprocess.run(
    ["python3", str(root / "scripts/bundle-plugin.py"), str(root / "build/plugin.js")],
    cwd=root,
    check=True,
)
subprocess.run(["pebble", "build"], cwd=root, check=True)
source_pbw = root / "build" / (root.name + ".pbw")
with zipfile.ZipFile(source_pbw) as source:
    entries = {name: source.read(name) for name in source.namelist()}
debug_entries = {}
for name, content in list(entries.items()):
    if name.endswith(".map"):
        debug_entries["sdk/" + name] = entries.pop(name)
originals = {
    "pebble-js-app.js": entries["pebble-js-app.js"],
    "plugin.js": (root / "build/plugin.js").read_bytes(),
}
for name, content in originals.items():
    input_file = root / "build/release-input" / name
    output_file = root / "build/optimized" / name
    output_map = output_file.with_suffix(".js.map")
    input_file.parent.mkdir(parents=True, exist_ok=True)
    input_file.write_bytes(content)
    args = [
        "node",
        str(root / "scripts/minify-js.cjs"),
        str(input_file),
        str(output_file),
        str(output_map),
    ]
    map_name = "sdk/" + name + ".map"
    if map_name in debug_entries:
        input_map = input_file.with_suffix(".js.map")
        input_map.write_bytes(debug_entries[map_name])
        args.append(str(input_map))
    subprocess.run(args, cwd=root, check=True)
    entries[name] = output_file.read_bytes()
    debug_entries["sdk/" + name] = content
    debug_entries["runtime/" + name] = entries[name]
    debug_entries["runtime/" + name + ".map"] = output_map.read_bytes()
appinfo = json.loads(entries["appinfo.json"])
appinfo["manifestVersion"] = 2
appinfo["usesPermissions"] = package["pebble"]["usesPermissions"]
appinfo["configPage"] = package["pebble"]["configPage"]
appinfo["plugin"] = package["pebble"]["plugin"]
entries["appinfo.json"] = json.dumps(appinfo, indent=2).encode()
entries["config.html"] = (root / "config.html").read_bytes()
for name in (
    "LICENSE",
    "THIRD-PARTY-NOTICES.md",
    "licenses/Apache-2.0.txt",
    "licenses/OFL-RobotoCondensed.txt",
):
    entries[name] = (root / name).read_bytes()
destination = output_directory / ("Open-Activity-" + package["version"] + ".pbw")
destination.parent.mkdir(parents=True, exist_ok=True)
debug = destination.with_name("Open-Activity-" + package["version"] + "-debug.zip")
debug_entries["manifest.json"] = (
    json.dumps(
        {
            "version": package["version"],
            "tool": "terser",
            "toolVersion": "5.46.0",
            "policy": "ES5; no compression/property mangling; keep function names and licence comments; no runtime map URL",
            "bundles": {
                name: {
                    "sdkSha256": hashlib.sha256(content).hexdigest(),
                    "runtimeSha256": hashlib.sha256(entries[name]).hexdigest(),
                }
                for name, content in originals.items()
            },
        },
        indent=2,
    ).encode()
    + b"\n"
)
for artifact, contents in ((destination, entries), (debug, debug_entries)):
    with zipfile.ZipFile(artifact, "w", zipfile.ZIP_DEFLATED) as output:
        for name, content in sorted(contents.items()):
            entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            output.writestr(entry, content)
(destination.parent / "SHA256SUMS.txt").write_text(
    "".join(
        hashlib.sha256(artifact.read_bytes()).hexdigest() + "  " + artifact.name + "\n"
        for artifact in (destination, debug)
    )
)
from repo_workflow import record_build

record_build(root, destination, debug)
subprocess.run(
    ["python3", str(root / "scripts/check-artifact.py"), "--pbw", str(destination)],
    cwd=root,
    check=True,
)
subprocess.run(
    ["node", "--test", str(root / "tests/package.test.js")],
    env={**__import__("os").environ, "PEBBLE_PBW": str(destination)},
    cwd=root,
    check=True,
)
print(destination)
