# Open Activity maintainer notes

On `design/pebble-native-redesign`, local 0.3.0 is an experimental visual
alternative; read [docs/REDESIGN.md](docs/REDESIGN.md). Native setup uses stock
Gothic fonts without custom font allocations. Preserve the routing, passive
settings inbox and original attempt budget. Main and the shared design standard
remain the comparison baseline until Xef approves this alternative.

This is one stock PebbleOS Quick Launch watchapp for both Dynamic activity
positions. Preserve UUID `d2d0bf48-cf4c-42f6-8b5f-3657fb2de4e9` and message keys.
Target Emery. GitHub development prereleases live in
`xefensor/pebble-app-open-activity`. Preserve published tags and artifact bytes;
later documentation commits on `main` do not rewrite a tested release snapshot.

- Use the existing SDK and official phone app. No firmware/mobile-app forks.
- Never change global Quick Launch assignments. Users assign this same app to
  their desired buttons; the phone settings choose Primary or Secondary.
- Settings has exactly two shortcut pickers: Primary activity and Secondary
  activity. Each chooses any stock hold/tap/combination or Not assigned. Reject
  a duplicate nonempty choice visibly; never clear or change the other picker
  silently. Unselected shortcuts close once version2 choices are saved.
- Support all eight stock shortcut identities: Hold Back/Up/Center/Down,
  Tap Up/Down, Hold Back+Up and Hold Up+Down. Preserve gesture as well as button
  identity with OA_GESTURE (2007). Accept only their exact action/button pairs;
  a combination must never use the representative button's hold mapping.
- Native validates launch reason, gesture and button. Ordinary user/menu, phone
  and system launches show a static setup screen and stay open for phone settings
  until ordinary Back. Unsupported launch reasons/gestures close. Quick Launch
  alone owns the four-second opening deadline and attempt Back handler.
- Dynamic's exact navigation source returns recent displayed destinations.
  Validate provider, schema, bounded metadata, original expiry and selected role.
  Never independently rank activities or substitute Primary for absent Secondary.
- Keep one transient opening attempt and one AppMessage queue. Confirm native
  liveness immediately before dispatch, invoke once, and never replay after a
  duplicate, timeout, reconnect or unrelated session.
- Store only user settings. Never cache navigation records, activity content,
  notification text, titles, artwork or invocation arguments in this app.
- The official launch API cannot recall a command already sent and currently
  targets every connected watch. Document one-connected-watch support and the
  recent-Dynamic behavior across watchfaces; do not invent stricter guarantees.
- Use `npm test`, `npm run build` and the packaged artifact check. Separate
  portable/emulator evidence from real-phone and physical-watch testing.
- Preserve the PolyForm Noncommercial required notice and the SDK Apache notice.

`src/c/attempt.*` is the portable native attempt state machine; `main.c` owns SDK
input, lifecycle, UI and messaging. `src/pkjs/launcher.js` owns the single bounded
phone attempt; `navigation.js` validates the read-only routing record.
`config.html` and `src/plugin/index.js` provide the primary phone settings page
independently of native lifetime. The config-only plugin is bundled in this same
PBW, exposes no sources/actions and uses the same UUID-scoped settings store.
The phone's configuration entry can require the watchapp to be running; ordinary
setup mode makes that route usable without changing Quick Launch's auto-close.

`src/pkjs/settings-page.js` owns the shared bundled/legacy settings template.
The build generates `config.html` with `scripts/generate-config.cjs`; do not
maintain a separate layout or controller in generated HTML. Both paths use
version2 primaryShortcut/secondaryShortcut preferences and retain the legacy
Cancel/Save return URL and existing storage key. Load version1 records without
writing or changing their actual routing; project existing matching shortcuts
for the two pickers. Explicit Save converts the older record to version2.
Show the conversion state and preserve the prior record until that Save.

Phone settings use the phone's light/dark appearance, clear cards, 44px targets,
an always reachable Save/status area and disclosed setup/default help. Keep
unchanged saves disabled. A load failure must show unknown choices and Retry,
never editable replacement defaults. An unreadable preference record may show
defaults for review, but only explicit Save repairs it. Ordinary Discard restores
the confirmed local snapshot without a backend write. An unconfirmed Save must
remain uncertain until explicit readback or a confirmed retry; never claim
that discarding a draft undoes a write already sent. Timeout/late callbacks
must not overwrite a later loaded or edited draft.

The action area reserves its measured height on regular screens. Short visual
viewports and oversized action areas use normal document flow with full-width
actions; never let fixed controls cover a focused field or the final help text.
Keep focus and scroll under normal browser control during loading, saving and
Retry. A shortcut conflict has an inline description associated with both fields
and the live status announcement; hide generic assignment copy during a conflict.

Version 0.1.5 defers the legacy settings module until showConfiguration and
coalesces footer measurement into one animation frame with unchanged-value write
checks. Preserve short-viewport/oversized-text flow and the exact two choices.
Release-only Terser 5.46.0 uses no compression or property mangling: settings
functions are serialized with toString. Keep source maps/original SDK scripts
in the separate versioned debug ZIP; recompute code/map identity in the artifact
check. Published app/debug/source bytes need a new version. Generate the source
archive last with package-source.py, then its --check mode after committing.

Version 0.1.6 adds setup mode for APP_LAUNCH_USER/PHONE/SYSTEM. Leave Back to the
normal OS window stack there; show the standard status-bar clock and static
instructions. Do not create an OA session/nonce, timeout, native AppMessage
channel or connection subscription in setup. PKJS can still send its one ready
bootstrap request, but no native HELLO means no navigation read or app launch.
Keep the Quick Launch gesture checks, init/nonce, budget and handshake unchanged.

Settings Save uses current Pebble.targets(): active PKJS owns the write so its
Android DOM snapshot and native storage agree. The closed config plugin remains
available where the phone UI permits it. Both handlers acknowledge exact saved
version2 choices. Reads preserve version1 bytes/routing until explicit Save.
After plugin ACK, recheck for newly started PKJS and synchronize the same choices.
On live PKJS transport failure, only confirmed target disappearance permits
plugin fallback. Unknown/still-live targets or wrong ACKs stay unconfirmed and
retain the draft. Bound handoffs to three writes. Keep separate native/DOM-store
regressions and archived browser reload/teardown coverage; a shared Map masks
the Android overwrite. Configuration handlers must never restart the launcher.

## Shared UI/UX alignment in local candidate 0.2.0

Read [the UI/UX alignment handoff](docs/UX-ALIGNMENT.md) and
[0.2.0 validation](docs/qa/0.2.0/VALIDATION.md) before interface changes. The native
setup uses Roboto Condensed, a title/time header and saved light/dark/violet roles.
Existing routing v1/v2 bytes and app identity remain independent of UI preferences
in `open-activity-ui-v1`; old records remain untouched until explicit Save.

OA_THEME (2008) is appended and OA_SETTINGS (7) is appearance-only. Initial phone
startup piggybacks theme on the existing REQUEST. Unlike the historical 0.1.6
setup, 0.2.0 opens a settings-only inbox; it must never emit HELLO, create an
attempt nonce/timeout, subscribe to navigation or launch an app. Its clock uses
minute ticks. Verified changed appearance updates persist before repainting;
unchanged updates never write flash. Keep the original four-second Quick Launch
budget measured before font loading and theme application.

The bundled page stays open after confirmed Save and keeps ✓ Saved until edited.
English/Czech copy follows browser locale. Preserve exact writer/storage receipts,
separate Android DOM/native-store tests and uncertainty/readback distinctions.
Only explicit rejected-before-write responses show Couldn’t save. Try again.;
timeouts and unknown outcomes stay Save not confirmed. The legacy return-URL
path still closes and explains that limitation. Persist public appearance only;
never cache activity content, routing records or invocation arguments.

This candidate is local, not a published release or a physical-device claim.
Preserve older published artifacts and tags.
