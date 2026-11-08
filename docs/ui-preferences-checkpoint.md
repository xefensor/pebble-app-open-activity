# Open Activity preferences checkpoint — 2026-11-08

Local candidate only; no version change, push or publication. The existing phone
Save flow now includes independent Text Size and Appearance. Manual sizes use the
same native role profiles as the matching Pebble sizes. Saved settings load before
both setup and Quick Launch; their load time stays inside Quick Launch's original
four-second budget. Existing shortcut/provider records and wire identities remain
compatible. [UI](UI.md) and [maintenance contracts](MAINTENANCE.md) define ownership.

Follow Pebble Text Size works on the baseline. Follow Appearance remains a saved
choice with its last Light/Dark fallback; the page explains the unavailable SDK
API. New display choices confirm only on passive setup, opened from the watch's
app list. The phone gives that instruction. Quick Launch uses the last confirmed
profile and never enters a new display handshake or retry loop. A pending phone
choice survives reopening and can apply on the next passive setup connection.
Only exact native persistence/readback/application receipt permits Applied on
watch. Transport success and queued/deferred hints cannot establish it.

## Candidate and checks

`build/candidate/Open-Activity-0.3.3.pbw` SHA-256:
`e8c5eef0623c423b0cc836710cc5a1ba9479a5739d9f75eadaa248eaefb7992a`.
SDK 4.33.1 / CLI 5.0.40. Local checks used Node 26.12.0 / Python 3.13.16;
the documented Node 22.23.4 / Python 3.12.15 pair was unavailable locally.
Native footprint is 9,128 bytes, resources 5,520 bytes and pre-runtime free RAM
121,944 bytes. These are build figures, not a runtime peak measurement.

- `npm test`, `npm run build`, `npm run check:artifact` and `npm run check:config`
  pass. Source checks include 112 JS cases and the actual native SDK adapter.
  They cover all eight shortcut identities, exact face/role routing, four-second
  attempt ownership, cancellation, duplicate dispatch, allocation cleanup,
  legacy settings, unchanged shortcut bytes through isolated display saves,
  phone persistence failures, exact receipts, and all 17 phone locales.
  New native callback cases verify live relayout and persistence, failed writes
  leave the old profile with a failure receipt, and a display frame during Quick
  Launch changes neither its profile nor its original deadline.
- `python3 scripts/emulator-preferences-bridge.py` executes the exact optimized
  packaged plugin and PKJS against the final native payload in Emery. A choice
  saved while the watch is closed starts pending. REQUEST alone does not enable
  display delivery; native passive-setup proof does. Actual transport ACKs and
  native save/readback receipts then establish Applied with the exact choices.
  All three manual sizes, Light/Dark, retained Follow Appearance with Dark fallback
  and native relaunch pass. Subscription/action APIs in this harness are forbidden.
  Firmware 4.33.2: `build/qa/preferences-bridge/1794163197857217255/report.json`.
  Firmware 4.45.0: `build/qa/preferences-bridge/1794163197851841152/report.json`.
  Each includes three settled raw native captures.
- `python3 scripts/emulator-smoke.py --native-sizes --repeat-cycles 5 --output build/qa/preferences-native`
  passes on Emery 4.33.2: 28 captures, real OS sizes, light/dark, complete clocks,
  scroll access, offline setup, Back, startup colour restoration and five extra
  cleanup cycles. Setup can outlive four seconds and emits only UI receipts,
  without an activity operation or session. Evidence:
  `build/qa/preferences-native/report.json`.
- `node scripts/check-settings.cjs` executes the exact packaged HTML and optimized
  handlers in local Chromium with simulated independent Android stores. It checks
  five selectors, 320/360px Light/Dark, 44px targets, labels, no overflow, Save/Discard,
  lost or mismatched replies, live-writer handoff, reopening, shortcut conflicts,
  keyboard access, enlarged text and Czech. Loading/saving settings cannot subscribe
  to an activity or launch an app. Evidence: `build/qa/settings/report.json`.

The watch runs unmodified native code in QEMU; the phone SDK and storage above are
simulated. Portable launch-reason/gesture cases are not OS Quick Launch gesture
runs. The earlier native type checkpoint's localized fixtures remain separate.

## Pending physical checks

No physical phone or Time 2 was available. Disconnect the watch, save a manual
size and Dark, close/reopen the page and check the same pending choices. Reconnect
and open Open Activity from the app list. Check Applied on watch, the chosen setup
size/palette and persistence after relaunch. Change back to Follow Pebble text and
compare after changing the watch size and relaunching. Then test the configured
Quick Launch inputs against each selected face: one correct activity launch,
Back cancellation, missing Secondary, offline failure and the original budget.
Published-build upgrade and real-phone discovery remain in the cross-project stage.
