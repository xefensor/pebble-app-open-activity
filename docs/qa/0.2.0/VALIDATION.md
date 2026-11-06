# Open Activity 0.2.0 local candidate validation

This is a local candidate implementing the agreed XOCE interface standard.
No repository push, public release, phone-app fork or physical-device test is
claimed by this record.

## Implementation

- The native passive setup uses Roboto Condensed, title-left/local-time-right,
  neutral light/dark surfaces and a violet accent. Normal Back remains native.
- The last confirmed native appearance is restored before phone data. A minimal
  appearance-only inbox is the intentional lifecycle change from 0.1.6 setup.
  It never creates a launch session/nonce, source subscription, native HELLO or
  four-second setup timeout. Quick Launch keeps its original total budget.
- Appearance is public configuration in a separate versioned phone key and a
  native theme key. Existing v1/v2 shortcut records are unchanged by reads.
- The bundled phone settings route remains open and shows ✓ Saved until edited.
  Exact phone-persistence confirmation is separate from watch delivery. Explicit
  rejected-before-write replies and uncertain outcomes retain different recovery.
- The phone UI is translated into English and Czech. Native instructions remain
  English. The page keeps two role pickers plus one independent appearance choice.
- The legacy return-URL route still closes on Save and states that limitation.

## Automated and packaged checks

The recovery environment (`recovery-validation/env.sh`) uses the existing
Pebble tool 5.0.40 and SDK 4.33.1. No SDK/tool upgrade was required.

- `npm test`: 62 JavaScript checks plus the portable native attempt and actual
  production-callback tests pass. Coverage includes routing, duplicate/late
  events, allocation cleanup, setup with no activity handshake, native theme
  persistence/no-op/failed-write handling, separate Android stores, unknown
  writes/readback, and rejected appearance before any write.
- `npm run build` and `npm run check:artifact`: actual native/resource/font build,
  generated configuration, manifest/permissions/notices, minified bundle and
  chained source-map identity pass. Native loaded image: 4,072 bytes; virtual
  image: 4,180 bytes; resources: 20,110 bytes. SDK heap estimate is not a measured
  physical-watch memory or battery result.
- The actual PBW plugin/config/PKJS tests pass; old shortcut schemas and all eight
  gesture/button choices retain their meaning.

## Browser evidence

[settings/report.json](settings/report.json) records the exact reviewed PBW and
packaged file hashes. The installed Chromium runs actual packaged HTML, config
plugin and PKJS handlers against a mocked SDK bridge with separate Android
native/DOM preference snapshots. Eighteen workflow groups and nineteen captures
cover 320/360px light/dark pages, keyboard/short and enlarged-text layouts,
Save staying open, exact readback through close/reopen/reload/teardown, invalid
and uncertain writes, all shortcut choices, appearance persistence, no autofocus
and English/Czech labels/help/status. They do not establish a live phone WebView.

## Native emulator evidence

[emulator/report.json](emulator/report.json) records seven unmodified 200 × 228
captures of the exact packaged native binary in isolated Emery QEMU. It checks
normal setup beyond the four-second transition budget, appearance reception,
cold reopening in cached dark mode before phone data, invalid-theme rejection,
offline setup, ordinary Back and absence of a native activity handshake.

The emulator uses no real phone runtime. Quick Launch gesture/session paths
are checked by the production native adapter and packaged runtime separately.
The captures are native emulator output, not physical-watch photographs.

## Remaining device verification

Real-phone WebView/permission handling and watch-to-phone latency, physical
readability/button feel, display contrast under real lighting and battery use
remain device checks. New UI preferences do not change one-connected-watch
support, app-launch semantics or the immutable source/expiry contract.
