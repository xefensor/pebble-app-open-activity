# Readable supporting text — 8 November 2026

Open Activity's supporting text now uses the normal foreground colour. This removes
the grey wash from explanatory/help text and secondary labels: black on white,
white on black.

The change affects text ink, including inverted selection text where applicable.
Font sizes, layout, saved appearance choices, artwork, decorative separators,
source validity and action availability remain unchanged.

Current candidate: `build/candidate/Open-Activity-0.3.3.pbw`. SHA-256:
`d91d3cc46b6691ab188d3867ef319507d5b59c1b5056a8d8148e1a02532f63b7`.

`npm test`, `npm run build`, `npm run check:artifact` and
`npm run check:config` passed. 28 captures cover passive setup at all three actual OS sizes, light/dark, clock formats, offline behavior and Back.
Evidence: `build/qa/text-contrast/report.json`. Native runs used verified Emery 4.45.0 assets;
phone APIs/providers are simulated and no new physical-device test is claimed.

Existing checkpoint hashes describe their original candidates; this is a new
local candidate. No version bump or release archive was created.
