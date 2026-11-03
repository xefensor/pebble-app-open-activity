# Open Activity settings browser validation

The seven PNGs are unaltered Chromium captures of the actual packaged config page. `settings-320-*` and `settings-360-*` show phone light/dark appearance at 800px height; the other 320px captures show failed loading, an unconfirmed save and expanded setup help. The page follows phone appearance independently of the watch.

The browser executes the exact packaged config-only plugin with an isolated in-memory store and a simulated SDK message bridge. It reads defaults without writing them, edits independent mappings and resolved defaults, saves once while controls are disabled, cold-reopens settings, discards ordinary drafts locally, retries failed loads/saves, explicitly repairs unreadable preferences and reads back a plugin write whose acknowledgement was lost. A failed or timed-out save never turns ordinary local Discard into a false undo. Source/package hashes, target dimensions and checks are recorded in `report.json`.

Run local Chromium on loopback port9229, then `node scripts/check-settings.cjs`. `OPEN_ACTIVITY_CHROMIUM_ENDPOINT` can override the endpoint; an output directory is an optional first argument. No external page or package is fetched. These are actual browser/config-plugin checks with a mock bridge, not a phone WebView or physical Quick Launch test.
