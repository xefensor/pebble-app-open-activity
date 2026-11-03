# Open Activity validation

## 0.1.4 UI and accessibility pass — 3 November 2026

The page retains exactly two shortcut choices and the same version2 record,
native behavior and permissions. The UI pass fixes a demonstrated overlap:
in a 320×360 viewport, the previous fixed footer started at y235 while focused
Secondary occupied y315–359. The new action area flows below the page in short
viewports. Normal screens reserve the measured footer height; oversized action
areas also flow below the page. No product code moves focus or scroll on load,
Save or Retry.

Conflicts now have an inline explanation associated with both invalid fields
as well as the live status announcement. Generic assignment instructions are
hidden while that conflict is active. Otherwise the setup instruction names
the two selected shortcuts, or explains that neither role is assigned. Save
and Discard use concise labels; uncertain writes retain Reload saved.

- **50 JavaScript tests and both native harnesses pass.** Existing routing,
  schema1 conversion, two-choice validation, empty/unassigned roles, no-write
  loading, failure/retry/readback and packaged bridge behavior remain covered.
  New source checks cover the field-associated conflict and selected-shortcut
  setup instructions without adding configuration fields.
- **Actual packaged browser checks pass with 15 reviewed captures.** This
  includes 320/360px light/dark pages, all state/error/help captures, short
  320×360 and zoom-equivalent 160×400 CSS viewports, and enlarged text. Native
  focus scrolling keeps Secondary visible; actual Tab navigation reaches Save.
  There are still exactly two selectors, 44px targets and no horizontal overflow.
  The 160×400 CSS viewport models 200% reflow on a 320×800 display. Injected 32px
  text verifies the measured fixed-area reservation; 48px text separately
  verifies oversized actions returning to document flow. These are browser
  fixtures, not a physical-phone keyboard, browser zoom or WebView claim.
- **SDK 4.33.1 Emery build and artifact checks pass.** Loaded/complete native
  bytes remain 2,476 and virtual bytes 2,548. PKJS is 36,911 bytes. Native C,
  resources and the configuration plugin match 0.1.3 exactly. Native binary
  differences are only SDK resource timestamp bytes 124–125; manifest differences
  are only versionLabel. Its historical ordinary-launch QEMU evidence retains
  its original scope, rather than being relabelled as a new native run.
- **Six final cross-app privacy/role cases pass** with Dynamic 0.15.0, Timer
  0.9.0 and Open Activity 0.1.4. The actual packaged scripts cover 48 selected
  launches, 48 expired closures and 336 unselected-slot attempts without a
  source subscription or invocation. Each shortcut is saved for both roles;
  privacy, notification expiry and duplicate suppression remain covered. SDK,
  clocks and native confirmation are simulated.

Evidence: [UX review](UX-REVIEW.md), [tests](qa/0.1.4/tests.log),
[build](qa/0.1.4/build.log), [artifact check](qa/0.1.4/artifact-check.log),
[browser report](qa/0.1.4/settings/report.json),
[visual review](qa/0.1.4/settings/review-sheet.png),
[before/after geometry](qa/0.1.4/accessibility-comparison.json) and
[native identity](qa/0.1.4/native-identity.json), plus the
[final packaged cross-app report](qa/0.1.4/packaged-handoff.json).

Final PBW SHA-256:
`ea6ac6f87a93f839c159dcc353abfcd73ce0b767fd38359cbbcf77d80edef6a1`.

Real phone WebView/keyboard behavior, Quick Launch timing, physical button
release and battery remain device checks. Earlier source snapshots, tags,
artifacts and validation evidence are preserved.

## 0.1.3 two activity shortcut choices — 3 November 2026

The settings page now has exactly two dropdowns: **Primary activity** chooses
its shortcut and **Secondary activity** chooses its shortcut. Each offers all
eight stock shortcut identities or Not assigned. A duplicate nonempty choice
blocks Save and explains the conflict without changing the other field.

New saves use `{version:2,primaryShortcut,secondaryShortcut}` in the original
storage key. Unselected shortcuts close without subscribing to Dynamic or
invoking an app. Version1 records load without writes and retain their actual
routing until explicit Save. The page projects an existing matching shortcut
for each role, preferring explicit Down/Up choices, and explains the pending
conversion. No per-button controls or default-role selector remain.

- **49 JavaScript checks and both native harnesses pass.** Source and actual
  packaged tests cover each of eight choices for both roles, unselected closure,
  None, duplicates, swaps, cold reopen, version1 preservation/conversion and
  existing load/retry/Discard/uncertain-save recovery. The legacy return-URL page
  uses the same two fields and saves version2 only on explicit confirmation.
- **Actual packaged browser checks pass at 320/360px in light/dark mode.** Nine
  unaltered captures were reviewed. The two choices fit above the fixed actions;
  controls have labels, descriptions, visible focus, 44px targets and no
  horizontal overflow. Save/reopen covers 16 role/shortcut combinations. Loading
  old records leaves storage byte-identical until Save. Collision, migration,
  failed load/save, readback and setup help states are recorded separately.
- **Six cross-app privacy/role cases pass** with final Dynamic 0.14.0, Timer
  0.8.0 and Open Activity 0.1.3 scripts. These include 48 saved-role launches,
  48 expired closures and 336 unselected-slot attempts with no source subscription
  or invocation. Privacy, notification baseline/expiry, one launch per native
  confirmation and underlying Timer/Music restoration remain covered.
- **SDK 4.33.1 Emery build and artifact checks pass.** Loaded native bytes are
  2,476, virtual bytes 2,548 and PKJS is 34,344 bytes. Native C/protocol and native
  resources are unchanged from 0.1.2; binary differences occur only at SDK
  resource timestamp bytes 124–125. Its ordinary-launch QEMU evidence retains
  the original 0.1.2 scope; it is not relabelled as a new emulator run.

Evidence: [checks](qa/0.1.3/checks.json), [tests](qa/0.1.3/tests.log),
[build](qa/0.1.3/build.log), [artifact check](qa/0.1.3/artifact-check.log),
[browser report](qa/0.1.3/settings/report.json),
[native identity](qa/0.1.3/native-identity.json) and
[packaged cross-app handoff](qa/0.1.3/packaged-handoff.json).

Final PBW SHA-256:
`a5cad61d26b06f9d15464785c9978882d3c6aa3e15e2b8a0d61503cc07911191`.

SDK/storage/native transport in browser and cross-app fixtures are simulated.
No new physical gesture, real-phone timing or battery result is claimed.
Earlier source snapshots, release tags and published artifacts are preserved.

## 0.1.2 all Quick Launch shortcuts — 3 November 2026

All eight shortcuts exposed by the current official phone app now have
independent role mappings: four single-button holds, Up/Down taps, Back+Up and
Up+Down holds. Native sends the exact gesture with its button in HELLO using
appended key `OA_GESTURE` (2007); the phone no longer confuses taps/combinations
with holds. UUID, existing key numbers, four-second budget, one-launch
confirmation, Back cancellation, navigation expiry and permissions stay intact.
Dynamic 0.14.0 and Timer 0.8.0 need no update for this helper change.

- **42 JavaScript checks and both native harnesses pass.** Coverage includes
  all eight slot identities, each mapped to either role, cold settings reads,
  duplicate confirmation and rejection of unsupported/missing gesture metadata.
  Packaged tests execute the actual PKJS and configuration plugin. UI tests
  preserve all eight choices through Save/reopen, Discard and the legacy return
  URL. Existing failure/retry/uncertain-save behavior remains covered.
- **The version1 settings key/record and earlier choices are preserved.** New
  optional tap/combination groups and Back/Center holds inherit the saved default
  until explicitly changed. Loading old preferences does not write them or mark
  the page dirty. Saving one mapping preserves all the other mappings.
- **Actual packaged browser checks pass at 320/360px in light/dark mode.** The
  shared page and config plugin save and cold-reopen all eight mappings. Thirteen
  captures cover all three shortcut sections, loading/save errors and help;
  labels, descriptions, 44px targets, fixed actions and no horizontal overflow
  are checked. SDK storage/bridge are isolated browser fixtures.
- **SDK 4.33.1 Emery build and artifact checks pass.** Loaded native bytes are
  2,476 and virtual bytes 2,548. The complete native binary is 2,476 bytes and
  PKJS is 34,483 bytes. The standalone PBW includes the shared configuration,
  config-only plugin, LaunchApps permission and original license notices.
- **The exact new native binary ran in isolated Emery QEMU.** Ordinary phone
  launch closes and returns to the system. This native smoke test does not
  simulate Quick Launch gestures or the real phone plugin runtime; the SDK
  adapter harness separately exercises all eight gesture/button handshakes.
- **Six packaged cross-app privacy/role cases pass.** Forty-eight saved-slot
  launches cover all eight shortcuts with each mapped to both roles. Forty-eight
  expired-slot attempts close. Baseline suppression, privacy, source expiry,
  duplicate confirmation and underlying Timer/Music restoration remain covered.
- The eight slot identities and Back-release behavior were independently
  reviewed against pinned official phone/PebbleOS source and the local SDK.
  No firmware or mobile-app fork is involved. Physical gesture timing remains
  a device check, including Hold Back and the two combinations.

Evidence: [tests](qa/0.1.2/tests.log), [SDK build](qa/0.1.2/build.log),
[browser report](qa/0.1.2/settings/report.json),
[native smoke](qa/0.1.2/emulator/report.json),
[platform identities](qa/0.1.2/platform-quick-launch.json) and
[packaged cross-app handoff](qa/0.1.2/packaged-handoff.json).

Final PBW SHA-256:
`356dfe96eb3b33f95c2e193c5fa59c1f18e0b62f99735ed37e64cdf769d83b96`.

The integration fixture uses packaged Dynamic/Timer/Open Activity scripts with
simulated clocks, SDK and native confirmation. Physical button releases, real
phone settings/transport, cold-start latency, vibration and battery remain
device checks. Earlier published tags and artifacts retain their original bytes.

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
