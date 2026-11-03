# Open Activity

One Quick Launch app for Dynamic’s recently displayed **Primary** or
**Secondary** activity. It targets Pebble Time 2 (`emery`) using stock PebbleOS
and the official phone app. No phone-app or firmware fork is required.

Assign this same app to any of these Quick Launch shortcuts. Each has its own
Primary / Secondary / Use default choice in Open Activity's phone settings:

| Shortcut | Initial behavior |
| --- | --- |
| Hold Up | Open Dynamic’s Secondary activity app |
| Hold Down | Open Dynamic’s Primary activity app |
| Hold Center (Select) | Use default activity |
| Hold Back | Use default activity |
| Tap Up | Use default activity |
| Tap Down | Use default activity |
| Hold Back + Up | Use default activity |
| Hold Up + Down | Use default activity |

All assignments are named **Open Activity**. Default activity is initially
Primary. Tap, hold and combination choices are independent, including on the
same physical button. Existing Up/Down choices and your saved default survive
upgrading; previously unconfigured shortcuts inherit that default. Opening
settings does not save or reset anything. The app never modifies your global
Quick Launch assignments.

## Installation and settings

Use the updated Dynamic build that exposes `navigation/presented_activities`;
older Dynamic versions do not provide the required handoff. Download
[`Open-Activity-0.1.2.pbw`](https://github.com/xefensor/pebble-app-open-activity/releases/download/v0.1.2/Open-Activity-0.1.2.pbw)
from the [GitHub development prerelease](https://github.com/xefensor/pebble-app-open-activity/releases/tag/v0.1.2)
and install it through the Pebble app. Enable the current plugin
SDK support and allow **Launch apps** for Open Activity in the phone app.

Open its phone settings to choose each shortcut and Default activity. The
offline settings page is bundled in the PBW and works through a config-only
plugin with the same app UUID. It does not require the transition watchapp to
remain open, add another installed watchapp or expose an Activities service.

The page explains Primary as the large activity and Secondary as the smaller
row. **Button holds**, **Button taps** and **Button combinations** expose all
eight mappings. **Default activity** is a disclosure below them; each **Use
default** option shows its resolved role. **Setup & help** contains
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
want to use. Combinations can be assigned in the phone app's Quick Launch
settings. Only shortcuts assigned to Open Activity use these role choices;
other shortcuts keep their existing assigned apps. The app-list entry
intentionally closes if opened normally; use the phone app for configuration
and the configured shortcuts for opening activities.

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

Native validates the exact eight Quick Launch action/button pairs, starts a
session and sends the gesture, button and remaining UI budget. The appended
`OA_GESTURE` message key is 2007; existing keys retain their numbers. Hold Back
and the Back+Up combination are distinct from each other and from a fresh Back
press that cancels an opening attempt. The phone resolves one destination, then asks native
to confirm that exact session/ticket/role/destination. Only a matching live
confirmation can issue one Watch State `launch_app` invocation. Duplicate and
late callbacks cannot create another invocation.

The version1 preference record and `open-activity-settings-v1` key are retained.
`holdOverrides` supports `up`, `down`, `select` and `back`. Optional `tapOverrides`
supports `up` and `down`; optional `comboOverrides` supports `backUp` and `upDown`.
Omitted overrides use the saved `defaultRole`. The
[platform identity evidence](docs/qa/0.1.2/platform-quick-launch.json) pins the
official phone and firmware sources for these eight slots. Availability in
system settings depends on the installed phone/firmware version.

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
real-phone and physical-watch checks. Source history and downloadable development
prereleases are available in
[`xefensor/pebble-app-open-activity`](https://github.com/xefensor/pebble-app-open-activity).
Published tags and artifacts retain their tested bytes; later documentation on
`main` does not change the released source snapshot.
