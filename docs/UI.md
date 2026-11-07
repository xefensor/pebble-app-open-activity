# Open Activity: current UI

The current release is 0.3.3. Earlier downloads and frozen evidence retain
their original versions and interfaces.

The phone has a Dynamic/Halftone watchface selector, Primary and Secondary shortcut pickers, and separate appearance; missing watchface settings retain Dynamic; duplicate nonempty shortcuts are rejected visibly. Preserve version1 bytes/routing until explicit version2 Save. Setup uses22/24/26 Roboto Condensed with measured leading, full clock and saved appearance. Quick Launch loads only its main font; setup loads three, all allocations have cleanup/fallback paths. The helper has no action rail and never remaps global OS Quick Launch assignments.

Setup uses the shared `pebble-xoce-ui` full-width32px header with26px title and
clock,8px edge insets and the same divider as the other apps. Its concise title
is **Activity**; the launcher name stays **Open Activity**. Both text runs are
centered using actual glyph ink, including the recorded SDK Gothic fallback;
the title yields space to the full clock. Body instructions remain24px and
secondary instructions22px, with explicit lines and measured leading. Fonts
remain loaded and owned here. The header adds no launch handshake, animation
timer or change to the original Quick Launch budget.

`scripts/generate-header-ink.py` regenerates the committed setup-header metrics
from `build/emery/app_resources.pbpack`; `--check` compares them after an SDK
build. Its small ASCII/ellipsis/wildcard fallback fixture records the original
public SDK4.33.1 glyph measurement and source hash. Reusing that fixture is not
fresh native or real-device verification.

Preserve UUID, gesture/button wire identity and all eight supported shortcut identities. Ordinary user/phone/system launches show passive setup without an opening nonce or activity handshake. Quick Launch owns the original four-second budget measured before font loading, one attempt, cancellation and at most one dispatch. Validate the selected Dynamic/Halftone provider, embedded watchface identity, original schema/expiry and selected role; never fall back to the other face; never substitute Primary for missing Secondary or independently rank activities. Persist settings only, never navigation/activity content.

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
