# Changelog

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
