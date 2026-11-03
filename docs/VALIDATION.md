# Open Activity 0.1.0 validation

This is a local implementation candidate. It targets stock PebbleOS on Emery
and the current plugin APIs in the official phone app. Dashboard is outside
this implementation.

## Completed checks

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
SHA-256 `6e798b2fe52fb006caabeac4d0a85c582403529d82769364bb150200065083db`.

The workspace command environment is
`source /home/xela/Projekty/Pebble/recovery-validation/env.sh`. It supplies the
local SDK and uses Node’s single-process test mode for the restricted runner.
On a normal development machine use the equivalent installed SDK environment.

## Integration and physical checks still required

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
