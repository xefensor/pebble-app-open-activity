# Open Activity maintainer notes

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
- Native validates launch reason, gesture and button. Ordinary menu launches and
  unsupported gestures close. Native owns the four-second UI deadline and Back.
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
