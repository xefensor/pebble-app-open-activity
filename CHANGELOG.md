# Changelog

## 0.1.3

- Choose a shortcut for Primary activity and one for Secondary activity in two
  dropdowns. Each offers any supported tap, hold, combination or Not assigned.
- Reject assigning the same shortcut to both roles; leave the other choice
  unchanged and explain the conflict.
- Save a compact two-choice record; unselected shortcuts close. Keep older
  preferences and routing until the user explicitly saves the new choices.
- Retain gesture identity, native timing, permissions and settings recovery.

## 0.1.2

- Configure all eight Quick Launch slots independently: four button holds,
  Up/Down taps, and Back+Up or Up+Down combinations. Group them in phone settings.
- Append `OA_GESTURE` (2007) so the phone distinguishes taps, holds and
  combinations without changing existing message keys or launch safeguards.
- Preserve version1 preferences and existing choices. New mappings inherit the
  saved default until explicitly changed; system assignments stay user managed.
- Verify 42 JavaScript checks, two native harnesses, 13 browser captures, the
  SDK/artifact build and native ordinary-launch closure. Packaged SDK fixtures
  cover 48 saved-slot launches and 48 expired-slot closures; physical gestures
  and live phone/watch delivery remain device checks.

## 0.1.1

- Organize phone settings around the two common hold mappings, with resolved
  Default choices and compact setup/help disclosures. Add independent phone
  light/dark appearance, visible keyboard focus and 44px touch targets.
- Keep Save/status reachable. Disable unchanged saves and distinguish loading,
  dirty, saving, confirmed, failed and unreadable-preference states.
- Preserve drafts on save failure. Offer explicit readback after an unconfirmed
  save, and keep ordinary Discard local. Reject stale replies after Retry.
- Generate bundled and legacy settings from one template; preserve existing
  preferences, legacy Cancel/Save URLs, native launch behavior and permissions.

## 0.1.0

- Initial local Open Activity implementation for Dynamic's recent Primary and
  Secondary, with one transition watchapp and an independent config-only plugin.
