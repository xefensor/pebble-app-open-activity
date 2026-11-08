# Open Activity: current UI

The current release is 0.3.3. Earlier downloads and frozen evidence retain
their original versions and interfaces.

The phone has a Dynamic/Halftone watchface selector, Primary and Secondary shortcut pickers, and separate appearance; missing watchface settings retain Dynamic; duplicate nonempty shortcuts are rejected visibly. Preserve version1 bytes/routing until explicit version2 Save.

The development candidate uses PebbleOS system fonts through the independently
pinned UI library's native type profiles. `preferred_content_size()` is read at
launch and a local Text Size override takes precedence. Emery Small, Medium and
Large correspond to SDK values 1, 2 and 3; manual choices use those exact roles.
Header, MenuTitle and MenuSubtitle match the stock roles for the running firmware;
firmware 4.44's changed Large title/subtitle pair is selected separately. No
custom text fonts are loaded or bundled in the candidate.

Setup keeps the full-width header, left **Activity** label, right clock, 8px edge
insets and divider. The same native Header font measures and draws both text runs;
the label yields to the complete clock. The launcher name stays **Open Activity**.
The two complete instruction paragraphs use MenuTitle and MenuSubtitle. Their
measured wrapped heights determine leading and available space below the header.
A standard ScrollLayer owns Up/Down scrolling when longer text exceeds that space;
normal Back exits. There is no action rail or setup action on Select. Touch
navigation is not enabled by this candidate.

The opening state uses the native MenuTitle role with a measured, centered text
frame. Setup and opening retain their saved light/dark colors. Reading font roles
and measuring text do not restart or extend Quick Launch's original budget.
The previous bundled-font metrics and generator remain historical source only;
they no longer determine the candidate's layout.

Preserve UUID, gesture/button wire identity and all eight supported shortcut identities. Ordinary user/phone/system launches show passive setup without an opening nonce or activity handshake. Quick Launch owns the original four-second budget measured before font loading, one attempt, cancellation and at most one dispatch. Validate the selected Dynamic/Halftone provider, embedded watchface identity, original schema/expiry and selected role; never fall back to the other face; never substitute Primary for missing Secondary or independently rank activities. Persist settings only, never navigation/activity content.

## Native/phone verification

The [native type checkpoint](native-type-checkpoint.md) records the earlier
OS-size runs and locale fixtures. The [preferences checkpoint](ui-preferences-checkpoint.md)
records independent overrides, watch confirmation and the preserved launch budget.

Inspect actual affected compositions, full text, glyph/icon alignment, edges,
light/dark and relevant critical states. Keep the actual packaged native payload
and report hashes bound together. Preserve the accepted complete UI rather than
reintroducing a historical trial. Phone palette is independent of watch appearance.
Read [maintenance contracts](MAINTENANCE.md) before changing persistence, routing
or source lifecycle. Current build/QA commands are in [CONTRIBUTING](../CONTRIBUTING.md).

## Frozen evidence

[Version 0.3.2 evidence](qa/0.3.2/validation.json) belongs to its original
frozen build at `99b433bde7c693484ed346d03c7ef5461957ca95`. Routine development uses build/candidate and build/qa;
that output does not overwrite these records. Physical phone/watch checks and
fresh browser checks remain explicitly separate.

## Display preferences

The existing phone Save flow includes Text Size (Follow Pebble / Small / Medium /
Large) and Appearance (Follow Pebble / Light / Dark). Fresh defaults follow the
watch text size and retain Open Activity's previous Light appearance. Existing
explicit colours migrate without changing shortcut/provider records. Follow
Appearance is retained with its last explicit colour; the page explains the
unsupported system appearance API on the baseline SDK.

The display status separates Saved on phone / Pending on watch from Applied on
watch. Only an exact native persistence/readback receipt establishes Applied.
Launch Open Activity from the watch app list to apply pending display settings.
This passive setup channel creates no opening nonce or activity session. Quick
Launch uses the last confirmed display, makes its one bounded attempt and keeps
the original four-second deadline. Changing settings during Opening stays pending
for a later passive setup launch.


## Supporting text contrast

Supporting/help text uses the normal foreground colour rather than blended grey.
This keeps black text on white and white text on black readable without changing
type sizes or layouts. See the [contrast checkpoint](text-contrast-checkpoint.md)
for the current candidate and verification scope.
