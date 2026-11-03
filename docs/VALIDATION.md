# Open Activity validation

## 0.1.1 settings UX — 3 November 2026

This local candidate changes phone settings and their generated legacy fallback.
It preserves all native source, the four-second opening deadline, Quick Launch
validation, Back behavior, routing/launch protocol, version1 preferences,
config-only plugin and permissions. No app destination, fallback behavior or
global Quick Launch assignment was added.

- **36 JavaScript checks and both portable native harnesses pass.** New cases
  cover disabled unchanged saves, resolved Default choices, load failure and
  Retry, a timed-out load arriving after a newer edited draft, one pending Save,
  failed saves retaining drafts, and explicit repair. A backend write whose
  acknowledgement is lost stays uncertain; explicit readback reveals its stored
  result, and late acknowledgements cannot replace a newer draft. Ordinary
  Discard restores only the last confirmed local snapshot without backend work.
- **Actual packaged config HTML and config-only plugin pass browser checks**
  in installed Chromium at 320×800 and 360×800, in phone light and dark modes.
  Seven unaltered captures include loading/save errors and disclosed setup help.
  Controls have associated labels/descriptions, visible targets at least 44px
  high, no horizontal overflow and an always reachable save area. Browser checks
  execute packaged plugin cold-load/read/save/reopen, explicit Retry, draft
  retention, unknown choices after load failure, duplicate Save prevention and
  write-with-lost-acknowledgement readback. Storage and the SDK bridge are isolated
  mocks, not production phone settings.
- **Packaged VM tests pass for both settings paths.** The config plugin cold-
  starts without a native watchapp and persists mappings across fresh contexts.
  The actual packaged legacy PKJS generates the shared page and retains empty
  Cancel and encoded Save return URLs. Packaged launcher confirmation and
  duplicate-invocation checks still pass with simulated native/SDK messages.
- **SDK4.33.1 Emery build and standalone artifact check pass.** The native loaded
  image remains 2,436 bytes and virtual image 2,508; phone JavaScript is 31,093
  bytes. The config plugin and native resources are byte-identical to 0.1.0.
  Native binaries differ only in the SDK `resource_timestamp` field at bytes
  124–127; code, other metadata and relocation bytes match. The only changed
  `appinfo.json` field is `versionLabel`. Native source and all launch/model code
  match the previous commit. The SDK's standard RWX segment warning remains.
- **0.1.0 artifacts and QA assets remain unchanged.** Its native-only ordinary-
  launch QEMU evidence is reused with its original scope. No new emulator run
  was needed for a phone-page-only change, and no new physical-watch behavior
  is claimed.

Evidence: [test log](qa/0.1.1/tests.log), [build log](qa/0.1.1/build.log),
[artifact check](qa/0.1.1/artifact-check.log),
[package/source identity](qa/0.1.1/identity.json),
[browser report and captures](qa/0.1.1/settings/report.json).

Final PBW SHA-256:
`7cc5002735cccfb99f4c80881c8ac85ef988521ac183554fb7561feebd4be70c`.

Remaining device checks are the real Pebble phone WebView cold-start/save/reopen,
phone Back, system light/dark/keyboard behavior, Launch apps permission setup,
physical Up/Down Quick Launch holds, visible opening latency and the four-second
budget under cold phone startup. All launch limitations listed below remain:
one connected watch, Dynamic's recent selection from any face, whole-app opening
and no guaranteed recall after dispatch. Browser/portable results do not measure
watch battery, native heap or real SDK delivery.

## 0.1.0 historical implementation candidate

This is a local implementation candidate. It targets stock PebbleOS on Emery
and the current plugin APIs in the official phone app. Dashboard is outside
this implementation.

### Completed checks

On 3 November 2026, with SDK 4.33.1 and the workspace recovery environment:

- **30 JavaScript checks** passed. These exercise exact provider and bounded
  hint validation, both role mappings, malformed/inherited settings values,
  original expiry, synchronous/late/duplicate source results, native confirmation
  matching, Back, timeout, permission errors, failed transport, one invocation,
  and no reconnect replay.
- **Portable native attempt checks** passed with strict C99 warnings. They cover
  complete UUID validation, helper recursion, session mismatch, independent
  role selection, duplicate prepare, closure and millisecond-counter wrap.
- **Native SDK adapter harness** passed against the production `main.c`. It
  exercises launch reason/gesture/button gating, connected/disconnected startup,
  the actual Hello/Prepare/Confirm dictionary path, malformed string length,
  timeout and Back. It is a stubbed SDK harness, not a watch run.
- **The actual packaged phone JavaScript** was evaluated in a controlled VM and
  completed the exact Dynamic source → native confirmation → one launch call.
  The SDK and phone transport are mocked; this is not a real phone test.
- **The actual packaged config plugin and HTML** cold-started in controlled VMs,
  loaded default settings, saved independent mappings and read them from a new
  plugin context without any native session. The config plugin declares no
  sources/actions. This checks the packaged bridge contract, not a WebView.
- **The offline settings layout** was rendered in installed Chromium at 320px
  and 360px widths and visually reviewed. Controls and labels fit inside the
  page padding, and the Save button remains readable. The
  [capture report](qa/0.1.0/settings/report.json) identifies the source HTML and
  images. A mock ready/settings bridge fills the initial choices; this is a
  browser layout preview, not a real phone WebView.
- **The standalone distribution PBW built** and passed identity, permission,
  numeric message-key, offline configuration, notice and ELF/header checks.
  Loaded native image is 2,436 bytes; virtual image is 2,508 bytes. This establishes
  executable bounds; it is not a runtime heap or battery measurement.
- **The packaged native binary ran in isolated Emery QEMU**. An ordinary phone
  launch started and immediately stopped the helper, returning to the system
  watchface. The [report](qa/0.1.0/emulator/report.json) and
  [unaltered native capture](qa/0.1.0/emulator/phone-launch-returned.png) identify
  the exact artifact. QEMU did not run the phone plugin runtime or a Quick Launch
  hold. This evidence does not establish native automatic activity opening.

Only the SDK’s standard RWX linker-segment warning remains in the build; native
source compiled without additional warnings. The PBW currently validated has
SHA-256 `fc21fe61f649412b52bfda16469d0b09556a794d1e9c8c206ddbc0911d23a6d9`.

The workspace command environment is
`source /home/xela/Projekty/Pebble/recovery-validation/env.sh`. It supplies the
local SDK and uses Node’s single-process test mode for the restricted runner.
On a normal development machine use the equivalent installed SDK environment.

### Integration and physical checks still required

Use the updated Dynamic candidate and one connected watch:

1. Open the bundled phone settings with the helper closed; save/reopen both
   mappings in the real phone WebView.
2. Grant Launch apps, assign the same helper to Hold Up/Down, and verify both
   actual Quick Launch gestures. Ordinary app-menu opening must close.
3. Show Timer primary and Music secondary, then reverse their positions. Verify
   each shortcut follows the confirmed displayed role.
4. Leave Dynamic unchanged for several minutes. Verify its navigation status
   renewal remains usable and measure the transport/power cost.
5. Expire/withdraw the primary, promote Secondary, hide Secondary for layout,
   remove destinations and revoke permissions. Verify unavailable routes close.
6. Exercise a cold phone runtime, offline use, Back, timeout, delayed source
   results and late permission approval. The existing phone API cannot promise
   cancellation after dispatch; characterize any delayed switch.
7. Measure visible transition latency and verify Opening… is readable on the
   actual watch. The four-second budget is an initial value, not measured UX.

The supported behavior intentionally permits a still-valid Dynamic route after
switching to another face. Strict predecessor checking and multiple-watch
targeting are not supported. No production settings, physical watch or remote
Git repository were changed by these checks.
