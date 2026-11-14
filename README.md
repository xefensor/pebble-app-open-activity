# Open Activity

A Quick Launch shortcut that opens the app behind the primary or secondary activity recently
displayed by Dynamic or Halftone.

The current development checkout adds **Watchface → Dynamic / Halftone** in Open
Activity settings. Choose Halftone and Save when using Halftone; existing settings
keep Dynamic. This change is in development candidates, not the frozen download below.

## Store update 1.0.1

Current source prepares Open Activity 1.0.1 for the reviewed Store update. The new numeric version supersedes the existing public 1.0.0 binary without changing the public UUID. Its exact PBW, Store package, source and checksums are under `releases/`; earlier artifacts remain unchanged.

## Activities: see what is happening now

Activities are live updates shown by compatible XOCE apps and watchfaces, such as a countdown, music or a new notification. This feature connects compatible XOCE products; support depends on the app or watchface you choose.

When a Timer countdown is visible on Dynamic or Halftone, a configured Open Activity Quick Launch shortcut can open Timer. Choose your watchface and the large Primary or smaller Secondary activity in settings, then assign Open Activity to the matching Quick Launch shortcut. It opens the whole app, not a particular saved timer.

Sharing needs plugin support in the official Pebble phone app, the required permissions and a connected phone. Weather and battery readings use separate reading settings. Music and notification integration requires Android. Open Activity is optional; you can always open Timer from the watch’s app list.

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

The release candidate targets **Pebble Time 2 / Emery** and **Round 2 / Gabbro**, using **Pebble SDK 4.44**. Duo is deferred. Portable and
emulator evidence is versioned; physical phone/watch checks retain their documented gaps.
Existing screenshots keep their original version and provenance.

## Setup and use

Configure shortcut roles in its phone settings and assign it through Pebble Quick Launch. An ordinary launch shows setup; a shortcut attempts the matching presented destination once. See [setup and supported inputs](docs/UI.md).

The version notes below describe the published download. Development candidates
remain separate; use [CONTRIBUTING](CONTRIBUTING.md) for local builds.

## Version 0.3.3

- Use the shared full-width Activity header with measured title/time alignment and readable setup instructions.
- Bundle UI 0.1.1 and shared phone settings styling with Primary/Secondary shortcut choices and confirmed saves.
- Preserve app identity, all shortcut mappings, passive setup launches and the original Quick Launch timeout.

## Version 1.0.0 — stable release preparation

Add Time 2 and Round 2 SDK 4.44 builds and round-safe setup text. Preserve passive setup and the original Quick Launch budget.

Xef accepted the reviewed implementation for stable release preparation on 2026-11-13. Actual test coverage remains recorded separately; no physical-device result is implied. Publication is a separate step.

## Development

Use Node 22, Python 3.12 and a C compiler. SDK builds additionally need Pebble SDK 4.44 on
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

The development checkout supports English, Czech, Slovak, German, French, Spanish,
Italian, Portuguese, Dutch, Polish, Danish, Swedish, Norwegian, Finnish, Hungarian,
Romanian and Turkish on watch screens and phone settings. Watch text follows the
watch language; settings follow the phone language. Regional locale codes and
Norwegian nb/nn are accepted; unsupported languages use English. Provider text,
user labels and saved bindings keep their original values. Frozen release downloads
retain their original language coverage until a new release is published.
