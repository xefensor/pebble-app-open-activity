# Open Activity maintenance contracts

These are current implementation constraints. They apply when changing the
relevant subsystem, not as a requirement to reread every document for every edit.

## Ownership and compatibility

Preserve UUID, gesture/button wire identity and all eight supported shortcut identities. Ordinary user/phone/system launches show passive setup without an opening nonce or activity handshake. Quick Launch owns the original four-second budget measured before font loading, one attempt, cancellation and at most one dispatch. Validate the selected Dynamic/Halftone provider, embedded watchface identity, original schema/expiry and selected role; never fall back to the other face; never substitute Primary for missing Secondary or independently rank activities. Persist settings only, never navigation/activity content.

## Current interaction and product boundaries

The phone has a Dynamic/Halftone watchface selector, Primary and Secondary shortcut pickers, and separate appearance; missing watchface settings retain Dynamic; duplicate nonempty shortcuts are rejected visibly. Preserve version1 bytes/routing until explicit version2 Save. Setup and opening use PebbleOS native type profiles at the launch-time OS text size. Setup measures complete instruction paragraphs and uses native scrolling when needed. The clock retains its full measured width. No custom font loading or unloading occurs. The helper has no action rail and never remaps global OS Quick Launch assignments.

## Source ownership

src/c/attempt.* owns the portable bounded attempt; main.c owns SDK lifecycle, passive setup and messaging. src/pkjs/launcher.js and navigation.js validate one phone dispatch; settings-page.js generates both configuration paths.

## Phone persistence and evidence

For apps with phone settings, keep active-writer selection, separate Android
DOM/native storage views, exact application acknowledgements and bounded handoffs.
Saving stays open where supported; uncertain writes retain the draft and explicit
readback/retry. Discard cannot undo a write already sent. Load errors must not
silently replace saved choices with editable defaults. Do not introduce unsolicited
focus or scroll changes. Historical browser/emulator results do not validate a
new build. Keep portable, packaged, simulated transport and real-device claims distinct.

## Dependencies, identities and licences

Preserve public identifiers, message-key numbers, compatible storage formats,
licences and attribution. Pinned vendor archives/checksums remain independent of
sibling checkouts. Do not repin consumers or change published bytes as cleanup.

## History

[Earlier maintainer notes](history/maintainer-notes-before-rework.md) retain the
full rationale/history. Read them only when investigating an old decision.

## Display preferences and the launch boundary

`open-activity-ui-preferences-v1` stores desired text size, appearance, last explicit
colour, revision and exact applied receipt on the phone. Existing UI key
`open-activity-ui-v1` remains the colour-only mirror. Reads and the isolated display
API do not rewrite the version-1/version-2 shortcut record. The form’s explicit
Save commits its projected version-2 shortcuts as before. The original provider,
button, gesture and role fields retain their validation and numbering.

Native preference key 2 stores a verified 20-byte frame; legacy colour key 1 stays
compatible. AppMessage keys 2009/2010 are appended after 2008. The frame contains
version 1, three fields, status and a hello flag, then four-byte little-endian
revision, text-size choice, appearance choice and last explicit appearance.
Only a positive revision, valid enums and exact persistence readback can establish
an applied reply. A failed save leaves rendered choices unchanged and replies
with failure. The phone requires the same revision and every choice, independently
of transport success. Startup/reconnect mismatch invalidates an old receipt.

Only passive setup sends preference hello/replies or accepts a new frame. The
launcher enables display delivery after that native setup proof, through its
existing single queue. Ready alone sends only the original REQUEST. Starting a
Quick Launch stops display retry work and clears unsent settings; native ignores
new display frames during an attempt. It uses the saved profile loaded inside
the original launch budget. The two settings paths retain exact verified Save,
Android live-writer handoff and pending choices across reopening. No display
state creates a source subscription, navigation nonce or launch capability.
