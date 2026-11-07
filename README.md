# Open Activity

A Quick Launch shortcut that opens the app behind the primary or secondary activity recently
displayed by Dynamic or Halftone.

The current development checkout adds **Watchface → Dynamic / Halftone** in Open
Activity settings. Choose Halftone and Save when using Halftone; existing settings
keep Dynamic. This change is in development candidates, not the frozen download below.

## Download

[Version 0.3.3](https://github.com/xefensor/pebble-app-open-activity/releases/tag/v0.3.3) is a development prerelease.

[PBW](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.3.3/Open-Activity-0.3.3.pbw),
[source](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.3.3/Open-Activity-0.3.3-source.zip),
[debug files](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.3.3/Open-Activity-0.3.3-debug.zip), and
[checksums](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.3.3/SHA256SUMS.txt).

Install the PBW through the Pebble phone app. No separate library installation is needed.

Install [Dynamic
0.18.3](https://github.com/xefensor/pebble-watchface-dynamic/releases/tag/v0.18.3) separately.
Enable phone plugin support and Launch apps permission. Choose Primary/Secondary shortcuts in
Open Activity settings and assign matching Quick Launch buttons in the phone app. An ordinary
app-list launch opens setup; Quick Launch follows Dynamic’s original destination and expiry.

[Usage and controls](docs/USAGE.md) · [Current UI](docs/UI.md).

## Compatibility

The current SDK target is **Pebble Time 2 / Emery**, using **Pebble SDK 4.33.1**. Portable and
emulator evidence is versioned; physical phone/watch checks retain their documented gaps.
Existing screenshots keep their original version and provenance.

## Version 0.3.3

- Use the shared full-width Activity header with measured title/time alignment and readable setup instructions.
- Bundle UI 0.1.1 and shared phone settings styling with Primary/Secondary shortcut choices and confirmed saves.
- Preserve app identity, all shortcut mappings, passive setup launches and the original Quick Launch timeout.

## Development

Use Node 22, Python 3.12 and a C compiler. SDK builds additionally need Pebble SDK 4.33.1 on
PATH.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run check:artifact
```

[Contributor guide](CONTRIBUTING.md) · [Release preparation](docs/RELEASING.md) · [History index](docs/history/index.md).
Development outputs belong in ignored `build/`; published archives stay frozen.

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE). Preserve bundled third-party notices and attribution.
