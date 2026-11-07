# Open Activity UI/UX alignment — local 0.2.0 candidate

The `design/pebble-native-redesign` branch adds a **0.3.1 alternative under
review**. See [the redesign and its evidence](REDESIGN.md). Its enlarged native Gothic
fonts, centered text and phone spacing are implemented on this branch; they do not replace
the agreed baseline below until Xef chooses them.

Reviewed baseline: Open Activity 0.1.6; repository HEAD
`1702a46487b5d666744f54763f0ef6ab8c49e399` on 2026-11-06.

## Canonical design and status

The agreed standard is maintained in the local `xoce` website checkout at
`src/pages/docs/design/pebble-ui-system.md`. When that checkout's preview is
running, read [the unified Pebble UI/UX standard](http://127.0.0.1:4321/docs/design/pebble-ui-system/).
The website has no public repository or deployment yet; this is a local reference.

The agreed changes are **implemented in the local 0.2.0 candidate**, verified by
automated, packaged-browser and native-emulator checks. Real-phone WebView and
physical-watch timing remain unverified.
It does not claim that a released app follows the complete standard. Shared
visual roles use neutral light/dark surfaces and a restrained accent per app.
Exact accent colours and final pixel metrics still need reviewed native and
phone previews. Website colours and web fonts are a separate identity.

## Previous 0.1.6 baseline

- Ordinary app-list/phone/system launch shows a static setup screen that
  remains open. It uses the stock status-bar clock, centred Gothic text and a
  hardcoded white background. The transition screen is a minimal Opening…
  presentation with a bounded attempt.
- The phone page has exactly two shortcut pickers: Primary activity and
  Secondary activity. A duplicate selection is visibly rejected.
- The primary bundled settings path already stays open and checks exact saved
  version-2 choices. The legacy close-URL path still closes on Save/Cancel.
  Load failure, uncertain writes and an unreadable record have distinct states.
- The generated `config.html` and legacy page share their source template in
  `src/pkjs/settings-page.js`; they are not independently maintained layouts.

See [UX review](UX-REVIEW.md), `src/c/main.c`,
`src/pkjs/settings-page.js`, and `src/pkjs/settings.js`.

## Alignment requirements

- Align the setup typography, neutral light/dark presentation and meaningful
  app accent with the common watch language. Give its passive setup screen
  clear title/time context without adding an empty action bar or menus. Exact
  font resources and preference placement need a small native review.
- Keep Quick Launch transition UI quiet and brief. Preserve its four-second
  total budget, one dispatch, ordinary cancellation and automatic close on
  missing/expired routes or failed resolution. A styling change must not
  create navigation reads or attempts in ordinary setup mode.
- Align phone page anatomy, controls, disclosed help and inline Save states.
  Keep the two role pickers; do not restore eight separate gesture fields or
  silently change the other role to resolve a shortcut conflict.
- On the supported stay-open route use Saving… → ✓ Saved; edits → Unsaved
  changes; a known failed write → Couldn’t save. Try again. Keep Saved until edited, disable
  unchanged Save, preserve focus/scroll and retain failed drafts.
- An uncertain write or timeout shows Save not confirmed with explicit Reload
  saved or retry. Do not equate it with a known failed write or retry silently.
- Keep current exact-choice acknowledgements, active-writer selection,
  confirmed-load and uncertain-write recovery. Saved means confirmed phone
  persistence; the helper does not promise that it remapped Pebble's system
  Quick Launch settings. Record any legacy-route limitation separately.

## Acceptance checks for the implementation

- Inspect setup, transition and supported theme/font states on Emery.
  Ordinary setup must remain open for phone settings and leave Back to the
  normal OS window stack. No decorative work or hidden transition starts.
- Save, remain on the phone page, edit/save again, close, reopen and restart
  the phone runtime. Confirm both exact shortcuts, including Not assigned,
  survive. Retain version-1 read compatibility until an explicit version-2 Save.
- Check duplicate shortcuts, load failure, unavailable runtime, uncertain
  writes, target handoffs and late callbacks. Preserve drafts and the separate
  Android DOM/native-store regression coverage. Discard cannot recall a save
  already sent; use explicit Reload saved or retry for uncertain state.
- Check 320/360px widths, large text and short/keyboard visual viewports.
  Both fields, their error association and Save/help stay reachable without
  programmatic text-field focus or an unsolicited scroll jump.
- Recheck Primary/Secondary routing, gesture/button pairs, missing Secondary,
  disconnect, expiry, timeout and Back. Never substitute Primary, retry a
  dispatched open, or claim an app's internal item was selected.
- Use packaged settings/runtime/native checks for changed code and keep
  browser/emulator evidence distinct from real-phone switching and physical
  watch timing. Preserve existing identities, releases and artifact bytes.

## Local implementation and evidence

The candidate implements neutral phone tokens, violet accents, English/Czech
labels/help, persistent stay-open Save feedback, the separate Watch appearance
choice, and native Roboto Condensed/title/time/light/dark presentation. Routing
schema and existing shortcut choices remain unchanged. The native settings-only
inbox applies appearance without a launch session or handshake. Setup still stays
open past four seconds and uses ordinary Back.

The legacy return-URL route still closes on Save and identifies that limitation.
See [0.2.0 validation](qa/0.2.0/VALIDATION.md) for exact packaged and native evidence.
