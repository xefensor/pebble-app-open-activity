# Open Activity

One Quick Launch app for Dynamic’s recently displayed **Primary** or
**Secondary** activity. It targets Pebble Time 2 (`emery`) using stock PebbleOS
and the official phone app. No phone-app or firmware fork is required.

Assign this same app to two Quick Launch buttons, for example:

| Shortcut | Initial behavior |
| --- | --- |
| Hold Up | Open Dynamic’s Secondary activity app |
| Hold Down | Open Dynamic’s Primary activity app |

Both assignments are named **Open Activity**. Change the role mappings in Open
Activity’s phone settings. Other supported hold buttons use Default activity,
initially Primary. The app never modifies your global Quick Launch assignments.

## Installation and settings

Use the updated Dynamic build that exposes `navigation/presented_activities`;
older Dynamic versions do not provide the required handoff. Install the local
`dist/Open-Activity-0.1.1.pbw` through the Pebble app. Enable the current plugin
SDK support and allow **Launch apps** for Open Activity in the phone app.

Open its phone settings to choose Hold Up, Hold Down and Default activity. The
offline settings page is bundled in the PBW and works through a config-only
plugin with the same app UUID. It does not require the transition watchapp to
remain open, add another installed watchapp or expose an Activities service.

The page explains Primary as the large activity and Secondary as the smaller
row. **Default for other holds** is a disclosure below the two common mappings;
each **Use default** option shows its resolved role. **Setup & help** contains
the permission and Quick Launch steps. Phone light/dark appearance follows the
phone independently of the watch.

Save is enabled only for edits or an explicit settings repair. Ordinary
**Discard changes** restores the last confirmed choices without writing them.
If a save is not confirmed, the page keeps the draft and offers **Reload saved**
to read back storage, or an explicit Save retry; it does not pretend that local
discard can undo an already sent save. Failed loading never supplies editable
default choices. Phone Back closes without submitting unsaved edits; the legacy
page also retains its Cancel return URL.

In Pebble’s Quick Launch settings, assign **Open Activity** to each button you
want to use. The app-list entry intentionally closes if opened normally; use
the phone app for configuration and the configured holds for opening activities.

## Behavior

The helper briefly shows Opening… while it reads Dynamic’s confirmed recent
destinations. A valid selected destination opens automatically. A missing
Secondary never falls back to Primary. Missing/expired data, unsupported SDK,
disconnection, denied permission or a resolution error closes the helper.
Back stays available, and the initial native UI limit is four seconds from app
startup, including phone startup time.

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

The helper stores only its three shortcut settings. It keeps the selected app
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

Native validates Quick Launch reason/action/button, starts a session and sends
its remaining UI budget. The phone resolves one destination, then asks native
to confirm that exact session/ticket/role/destination. Only a matching live
confirmation can issue one Watch State `launch_app` invocation. Duplicate and
late callbacks cannot create another invocation.

## Development and validation

With the Pebble SDK installed:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run check:artifact
```

Edit `src/pkjs/settings-page.js` for both configuration paths. The build generates
`config.html` from that shared template; `node scripts/generate-config.cjs --check`
detects drift. The primary page uses Pebble's
[bundled settings bridge](https://developer.repebble.com/guides/plugins/preview/#settings-pages);
the legacy path keeps its `pebblejs://close#` return contract. Neither path
changes the preference schema or Quick Launch assignments.

For browser checks, start local Chromium with debugging on port 9229, then run
`node scripts/check-settings.cjs`. It executes the actual packaged HTML and
config plugin with isolated settings and a mock SDK bridge, checking read/save,
errors, retry, discard and 320/360px light/dark layouts.

There are no external npm dependencies. Distribution packaging adds
`manifestVersion: 2`, `LaunchApps`, the offline page, the config-only plugin and
license notices. Use the PBW under `dist/`; the plain SDK development PBW lacks
the extra configuration packaging.

The [validation record](docs/VALIDATION.md) distinguishes portable fault tests,
actual packaged-bundle checks and native-only QEMU evidence from the pending
real-phone and physical-watch checks. The repository currently has no remote.
