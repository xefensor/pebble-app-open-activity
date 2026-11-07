# Open Activity: current UI

The accepted UI is merged into main; implementation version 0.3.2 remains
unpublished. Published downloads retain their original versions and interfaces.

The phone has exactly Primary and Secondary shortcut pickers plus separate appearance; duplicate nonempty shortcuts are rejected visibly. Preserve version1 bytes/routing until explicit version2 Save. Setup uses22/24/26 Roboto Condensed with measured leading, full clock and saved appearance. Quick Launch loads only its main font; setup loads three, all allocations have cleanup/fallback paths. The helper has no action rail and never remaps global OS Quick Launch assignments.

Preserve UUID, gesture/button wire identity and all eight supported shortcut identities. Ordinary user/phone/system launches show passive setup without an opening nonce or activity handshake. Quick Launch owns the original four-second budget measured before font loading, one attempt, cancellation and at most one dispatch. Validate Dynamic’s original schema/expiry and selected role; never substitute Primary for missing Secondary or independently rank activities. Persist settings only, never navigation/activity content.

## Native/phone verification

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
