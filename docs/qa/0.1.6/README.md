# Open Activity 0.1.6 settings access and persistence

Local candidate on `fix/settings-access-0.1.6`, based on
`1d963c7a1adee58c1ceefedc96e27a00e20f383b`. Not published to GitHub.

The previous ordinary-launch exit made phone configuration impractical when the
phone required the watchapp to remain open. USER, PHONE and SYSTEM launches now
show a static setup screen with the standard clock until normal Back. Open the
app from the watch list, configure its two shortcuts in Pebble, Save, then Back.
Quick Launch retains the original gesture checks, nonce/handshake and four-second
opening budget. Setup creates no native attempt, messaging channel, timeout or
connection subscription. PKJS can send its existing one-time readiness request,
but receives no native HELLO and cannot read navigation or launch an activity.

Settings saves use current SDK targets: live PKJS writes both its Android DOM
snapshot and native preferences; the closed config plugin remains available to
phone configuration routes supporting it. Exact selected choices must be
acknowledged. Unconfirmed/still-live failures retain the draft; only a fresh
query confirming shutdown permits fallback. Handoffs are bounded to three writes.
The two selectors, permissions, UUID, v1 routing preservation and explicit v2
migration remain unchanged. Configuration cannot revive a cancelled attempt.

| Verification | Result |
| --- | --- |
| JavaScript | 59 passed, including six actual packaged tests and six new storage regressions |
| Portable native | Both suites passed; all eight Quick Launch gestures plus three setup launch reasons |
| SDK production build/artifact | Passed; exact Terser transformation and source-map identities recomputed |
| Actual archived browser | 16 check groups / 16 captures passed |
| Native Emery QEMU | Five behavior checks / four captures passed |

[Browser report](settings/report.json) binds the actual archived HTML and both
minified JS bundles to the final PBW. Separate Android DOM/native stores and
teardown are modeled, with complete page reload after active/closed saves. It
covers live failure without unsafe fallback, confirmed closure fallback, newly
appearing PKJS, wrong acknowledgments, failed target lookup, migration, conflicts,
focus, short viewports and enlarged text. No launcher/source/action work runs in
the settings fixture. Root reviewed the
[reopened settings](settings/settings-live-save-reopened-320.png).

[Native report](emulator/report.json) verifies ordinary phone-style launch stays
open beyond 5.2 seconds, offline setup stays open, Back returns normally and no
native handshake is emitted. Root reviewed the
[setup screen](emulator/setup-phone-launch.png). Real menu USER/SYSTEM reasons,
all eight Quick Launch gestures, malformed input, nonce/liveness, timeout and
Back are covered by the portable SDK adapter. It also checks setup after ten
seconds online/offline and allocation-failure cleanup. QEMU does not run the
phone runtime or simulate a physical Quick Launch gesture. The first attempt
stopped at an incorrect QemuButton test argument; its images/log remain under
`emulator/before-button-api-fix/`. Only the harness changed before the passing run.

The native file is 3,192 bytes, with loaded extent 3,168 and virtual extent
3,256 bytes. SDK-reported RAM footprint is 3,253 bytes and resources 4,092 bytes.
The runtime phone bundle is 25,960 bytes. All eight previous app/debug/source
artifacts retain their hashes in [the inventory](previous-artifacts.json).
See [artifact identity](artifact-check.json). No real-phone or physical-watch
test is claimed; the phone settings entry itself still needs device confirmation.

PBW SHA-256:
`0977885135f68687f86297adbcd1b3a19b90debc9d09810f398346f31a1fb580`.

```sh
source ../recovery-validation/env.sh
npm test
npm run build
npm run check:artifact
OPEN_ACTIVITY_EXPECTED_SHA256=0977885135f68687f86297adbcd1b3a19b90debc9d09810f398346f31a1fb580 node scripts/check-settings.cjs
python3 scripts/emulator-smoke.py --expected-sha256 0977885135f68687f86297adbcd1b3a19b90debc9d09810f398346f31a1fb580
python3 scripts/package-source.py
python3 scripts/package-source.py --check
```
