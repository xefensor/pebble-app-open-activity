# Pebble native redesign — review branch

Local **0.3.2** on `design/pebble-native-redesign` rebalances the whole setup
screen after Xef rejected isolated header enlargement. It is an alternative
for review, not an approved replacement for main or a published release.
The baseline is `8ab401c6b58c783be596143657d3be272517c870`.

Setup uses the same Roboto Condensed Bold utility family as the other apps:
22 for the full app name and secondary instructions, 24 for the main instruction,
and 26 for the clock. Actual capital ink is 16/17/19px. All text is readable
at a related scale rather than leaving a large clock above small body copy.
Explicit main and hint lines have 5px and 7px visible gaps in native captures;
there is 13px bottom clearance. Title and clock optical centers differ by 0.5px.
All 1,440 clock strings fit their field; the full title and instruction fit
without clipping. The font resources include Czech accents and punctuation.

The automatic Opening screen remains still and loads only its one main font.
Setup loads three; partial font or TextLayer allocation failures are cleaned up
and have system-font fallbacks. The four-second opening budget still starts
before font loading. Routing, Back cancellation and one dispatch are unchanged.
Ordinary setup remains open for phone configuration without an activity handshake.
Saved light/dark appearance and the violet identity remain.

Phone sections retain 16px card insets, a 24px section rhythm, 44px controls,
a 48px Save button, left-aligned status and symmetric disclosure padding.
Exactly two role pickers, the separate appearance selector, reduced-motion
feedback and the existing save/receipt/draft controller remain. This pass does
not change phone persistence or shortcut ownership.

## Review and evidence

- [Setup, light](qa/0.3.2/emulator/setup-phone-launch.png) and
  [dark](qa/0.3.2/emulator/setup-dark.png) are unmodified native Emery captures
  of the exact packaged candidate.
- [Phone preview](qa/0.3.2/phone-preview.html) uses the actual generated page
  and an in-memory mock bridge; it cannot change a phone or watch.
- [Validation](qa/0.3.2/validation.json),
  [whole-screen measurements](qa/0.3.2/readability.json) and
  [native workflow report](qa/0.3.2/emulator/report.json) record the checks.
  All 62 JavaScript tests, portable native harnesses, six packaged tests and
  artifact checks pass. Native setup was checked after four seconds, offline,
  after Back, after cold reopening with saved dark appearance and with wide
  and narrow clock strings. Portable tests cover all three font failures,
  six TextLayer failures and a font load exceeding the opening deadline.

Fresh browser rendering is blocked by the sandbox (Chromium and Firefox).
Phone WebView appearance and physical-watch timing remain unverified. Emulator
captures and portable tests do not establish physical Quick Launch performance.
Older PBWs, tags and main retain their bytes. Nothing has been pushed or published.

Build: `npm test`, `npm run build`, `npm run check:artifact`.
The local review PBW is `dist/Open-Activity-0.3.2.pbw`.
