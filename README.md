# Open Activity

Main contains the current implementation. [Development](CONTRIBUTING.md),
[current maintenance contracts](docs/MAINTENANCE.md) and [release policy](docs/RELEASING.md)
are the active contributor references. Public downloads and frozen evidence keep
their original versions; a merge to main is not publication.

Main includes the accepted local **0.3.2** UI. See [the changes, previews and checks](docs/REDESIGN.md).
The released downloads below remain the baseline; the merged implementation is unpublished.

One Quick Launch app for Dynamic’s recently displayed **Primary** or
**Secondary** activity. It targets Pebble Time 2 (`emery`) using stock PebbleOS
and the official phone app. No phone-app or firmware fork is required.

Part of **XOCE — Xef's Open Computing Ecosystem**. Its Dynamic activity source
is maintained in
[xefensor/pebble-watchface-dynamic](https://github.com/xefensor/pebble-watchface-dynamic).

**Historical 0.2.0 UI milestone.** The native setup uses
Roboto Condensed, a title-left/time-right header and saved light/dark appearance
with a violet accent. The phone page has English/Czech copy, two shortcut pickers
plus a separate Watch appearance choice, and persistent **✓ Saved** feedback
while remaining open on the bundled settings route. The frozen build is
`dist/Open-Activity-0.2.0.pbw`; [validation](docs/qa/0.2.0) distinguishes native
emulator and packaged-browser evidence from real-device checks. This candidate
has not been pushed or published.

**Open Activity 0.1.6 is published** as a development prerelease fixing
settings access and save persistence. The PBW is also available locally as
`dist/Open-Activity-0.1.6.pbw`; [validation](docs/qa/0.1.6) records its checks.
Earlier releases retain their original files.

Choose one shortcut for each activity in Open Activity's phone settings:

| Activity | Initial shortcut |
| --- | --- |
| Primary activity | Hold Down |
| Secondary activity | Hold Up |

Each dropdown offers Hold Up/Center/Down/Back, Tap Up/Down, Hold Back+Up,
Hold Up+Down, or **Not assigned**. Choose different shortcuts for the two
activities. Assign the same **Open Activity** app to those shortcuts in Pebble's
Quick Launch settings. Other apps keep their existing shortcut assignments.

Older preferences remain active until you explicitly save the new two-choice
configuration. The page selects an existing matching shortcut for each role,
preferring your explicit Down/Up choices. Opening the page never rewrites stored
preferences. Saving applies just the two selected shortcuts; other shortcuts
assigned to Open Activity close without opening an activity.

## Installation and settings

Use the updated Dynamic build that exposes `navigation/presented_activities`;
older Dynamic versions do not provide the required handoff. Download
[`Open-Activity-0.1.6.pbw`](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.1.6/Open-Activity-0.1.6.pbw)
from the [0.1.6 GitHub development prerelease](https://github.com/xefensor/pebble-app-open-activity/releases/tag/v0.1.6)
and install it through the Pebble app. The previous
[0.1.5 prerelease](https://github.com/xefensor/pebble-app-open-activity/releases/tag/v0.1.5)
remains available. Version 0.1.6 is frozen at tested source
[`82c47fa`](https://github.com/xefensor/pebble-app-open-activity/tree/82c47fa92e103a965a15ab9de55b84853a9e07bd);
later documentation on `main` does not replace its source archive or tag.
Enable the current plugin
SDK support and allow **Launch apps** for Open Activity in the phone app.

Open **Open Activity from the watch's app list**. It stays on a setup screen
with the time and instructions. Then open its settings in the Pebble phone app,
choose Primary/Secondary shortcuts and Save. Press Back on the watch when done.
This makes the normal settings route usable when the phone requires the
watchapp to be running. Quick Launch retains its automatic transition behavior.

The offline settings page is bundled in the same PBW/UUID. Its config-only
plugin can serve settings independently when the phone UI allows closed-app
configuration; no extra watchapp or Activities service is required.

The page explains Primary as the large activity and Secondary as the smaller
row. The page has two shortcut dropdowns and one separate Light/Dark watch-appearance choice. **Setup & help** contains
the permission and Quick Launch steps. Phone light/dark appearance follows the
phone independently of the watch.

Save is enabled only for edits, explicit conversion of older settings or a
settings repair. Ordinary
**Discard** restores the last confirmed choices without writing them.
If a save is not confirmed, the page keeps the draft and offers **Reload saved**
to read back storage, or an explicit Save retry; it does not pretend that local
discard can undo an already sent save. Failed loading never supplies editable
default choices. Phone Back closes without submitting unsaved edits; the legacy
page also retains its Cancel return URL.
While the helper is running, saves pass through its phone runtime so Android's
cached settings cannot replace the new choices when the app closes. When it is
closed, the config plugin saves them directly. A save is confirmed only when the
backend returns the exact selected choices and appearance. The small ✓ Saved
indicator remains until another edit. It confirms phone persistence, not watch
application. Appearance is sent again on the next app startup if the native
helper was closed. The legacy return-URL route still closes on Save, and its
help explains that limitation. Opening settings moves no focus and
never starts an activity-opening attempt.

The assignment instruction names the selected shortcuts. A conflict is explained
beside both fields and in the status area. Save and Discard stay at the bottom
on larger screens; on short screens or with oversized text, the actions move
below the page so they cannot cover a focused choice. Both choices and Save
remain reachable using the keyboard. See the [UI and UX review](docs/UX-REVIEW.md).

In Pebble’s Quick Launch settings, assign **Open Activity** to each button you
want to use. Combinations can be assigned in the phone app's Quick Launch
settings. Only shortcuts assigned to Open Activity use these role choices;
other shortcuts keep their existing assigned apps. Normal app-list launches stay
open for setup; use the configured shortcuts for opening activities.

## Behavior

When started by Quick Launch, the helper briefly shows Opening… while it reads Dynamic’s confirmed recent
destinations. A valid selected destination opens automatically. A missing
Secondary never falls back to Primary. Missing/expired data, unsupported SDK,
disconnection, denied permission or a resolution error closes the helper.
Back stays available, and the initial native UI limit is four seconds from app
startup, including phone startup time. The normal setup screen has no opening
timeout, survives disconnection and exits through ordinary Back.

The shortcut opens the **whole associated app**. Timer opens Timer; media can
open Pebble’s Music controls. It does not select a specific timer, notification
or song, and it does not issue Pause/Stop/Next commands.

This is explicitly **Dynamic’s recent selection**, even when the shortcut is
used shortly after changing watchfaces. The current SDK cannot verify which
watchface immediately preceded this helper. Dynamic’s original routing expiry
is enforced; reading it never extends its validity.

Use one connected watch. The official `launch_app` action currently targets all
connected watches and provides no selection/count API to this app. After a
launch command is dispatched, Back/timeout cannot guarantee recall. The helper
does not retry or replay an attempt after reconnect.

## Data and protocol

The helper stores only its two shortcut choices. It keeps the selected app
UUID and expiry in memory during one attempt. It never stores activity content,
the navigation record, notification text, track metadata, artwork or an activity
history, and it has no Internet permission.

The phone reads exactly:

```text
provider: cc1281f1-3b4d-45b5-b235-6881b1fd8fbd (Dynamic)
category/item: navigation/presented_activities
instance: current
property: hint.longText.text
```

The JSON is capped at 512 UTF-8 bytes. Schema 1 carries `watchfaceUuid`, positive
uint32 `nativeSession`, `viewSequence`, `presentationSequence`, original
`presentedAtMs`/`expiresAtMs`, and `primary`/`secondary` as either null or exactly
`{watchAppUuid}`. The lease is at most 45 seconds. Unknown fields, malformed
identities, wrong providers, expired data and helper-self destinations fail.

Native validates the exact eight Quick Launch action/button pairs, starts a
session and sends the gesture, button and remaining UI budget. The appended
`OA_GESTURE` message key is 2007; existing keys retain their numbers. Hold Back
and the Back+Up combination are distinct from each other and from a fresh Back
press that cancels an opening attempt. The phone resolves one destination, then asks native
to confirm that exact session/ticket/role/destination. Only a matching live
confirmation can issue one Watch State `launch_app` invocation. Duplicate and
late callbacks cannot create another invocation.

The `open-activity-settings-v1` storage key is retained. The version2 record is
`{version:2,primaryShortcut,secondaryShortcut}`. Each choice is one of the eight
shortcut IDs or `none`; a nonempty shortcut cannot be assigned to both roles.
Version1 records retain their previous routing until explicit Save replaces
them. The
[platform identity evidence](docs/qa/0.1.2/platform-quick-launch.json) pins the
official phone and firmware sources for these eight slots. Availability in
system settings depends on the installed phone/firmware version.

## Development and validation

Use [CONTRIBUTING](CONTRIBUTING.md) for current setup, safe candidate builds and
verification. Release preparation is a separate [explicit workflow](docs/RELEASING.md).
