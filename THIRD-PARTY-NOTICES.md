# Open Activity third party notices

Open Activity uses the PolyForm Noncommercial License 1.0.0 and required notice
in `LICENSE`. Its build script follows the existing Timer packaging convention;
that code and its notice retain the same license.

The Pebble SDK injects `_pkjs_shared_additions.js` into the phone JavaScript.
Its original Copyright 2024 Google LLC and Apache License 2.0 notice remain in
the bundle. The full Apache license is included in `licenses/Apache-2.0.txt`.

The app uses Pebble's built-in system fonts. It bundles no external font, image,
audio asset, Activities runtime, native background worker or third-party npm
runtime package.

Release builds use the pinned, development-only Terser 5.46.0 tool under its
BSD-2-Clause licence. Its implementation and npm dependencies are not included
in the installed app. `licenses/Terser-BSD-2-Clause.txt` preserves the build-tool
licence; the lockfile pins its dependency integrity.
