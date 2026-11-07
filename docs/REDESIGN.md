# Pebble native redesign — review branch

This is an alternative for Xef to review on `design/pebble-native-redesign`,
based on `8ab401c6b58c783be596143657d3be272517c870`. Local version **0.3.0**.
It is not an approved replacement for the shared standard or a published release.

The watch now uses Pebble's Gothic 18 Bold title/time, Gothic 24 Bold instruction
and Gothic 18 secondary text. The frames fit those actual fonts. The violet
identity and independent saved light/dark appearance stay. Removing custom font
loads also removes their allocation and cleanup work.

The automatic Opening screen remains still and uses Gothic. It keeps the original
four-second attempt, Back cancellation and one dispatch. Setup still opens
without an attempt or activity handshake and stays open for phone configuration.
There is no empty action bar or added animation before opening an activity.

Phone sections use neutral headings, 16px card insets, a 24px section rhythm,
44px controls, a 48px Save button and a left-aligned status. The violet Save
colours adapt to phone appearance. Button feedback and help disclosure are brief
and respect reduced motion. Exactly two role pickers and the separate watch
appearance selector remain. The actual save, receipt, routing and draft code is
unchanged.

## Review and evidence

- [Watch setup, light](qa/0.3.0/emulator/setup-phone-launch.png) and
  [dark](qa/0.3.0/emulator/setup-dark.png): actual packaged native code in Emery
  QEMU, with unmodified screenshot pixels.
- [Phone layout preview](qa/0.3.0/phone-preview.html): actual generated page with
  an in-memory mock bridge. Save affects this preview only. Opening it directly
  never contacts a phone or watch.
- [Validation record](qa/0.3.0/validation.json) and
  [emulator report](qa/0.3.0/emulator/report.json): portable controller/native tests,
  all six packaged tests, build and artifact checks pass. Setup was checked after
  four seconds, offline, after Back and after reopening with the saved dark theme.

Fresh Chromium rendering is blocked by this environment's sandbox. The phone
preview has not been visually verified here. Real phone WebView and physical
watch timing remain unverified. Older versioned PBWs, tags and main are retained.

Build locally with the SDK on PATH: `npm test`, `npm run build`,
`npm run check:artifact`. The review PBW is `dist/Open-Activity-0.3.0.pbw`.
