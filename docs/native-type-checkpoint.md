# Native type checkpoint

This is development-candidate evidence from 2026-11-08, not a new release.
The package version remains 0.3.3. The shared native type dependency is the
independent candidate recorded in [vendor/UI.json](../vendor/UI.json).

Setup and opening now use PebbleOS Header, MenuTitle and MenuSubtitle roles.
The complete clock reserves its measured width before the header label. Complete
setup paragraphs wrap at their measured native size and remain in a standard
ScrollLayer. No custom font resources or font loading remain in the candidate.
There are no protocol, routing, UUID, shortcut, storage-key or deadline changes.

The exact packaged candidate is `build/candidate/Open-Activity-0.3.3.pbw`:

| Payload | SHA-256 |
| --- | --- |
| PBW | `189da4abe63260ed0d3bb27fe228edb0a44c840ff7db3ed71fd38847299f1dfb` |
| Native binary | `ec7e3a133a25feb763266f7792e60459e8e3cd1c3ecf34ec9b879c4ffdfd4e03` |
| Resources | `229201b43926a71007211c5f99880d8ceb99391abfc638d2cf22cf6387680cc6` |

`npm test`, `npm run build` and `npm run check:artifact` passed. This includes
85 JavaScript tests, portable native attempt and SDK-adapter checks, packaged
shortcut/provider routing and configuration execution, and workflow, release and
locale-resource checks. Two release-only workflow cases are intentionally skipped
outside their release context. The adapter tests exercise all eight shortcut
identities, all three passive launch reasons online/offline, duplicate prepare,
wrong session, malformed destination, Back, timeout and disconnect. The original
four-second budget still starts before reading UI preferences or measuring fonts;
an injected UI-loading delay beyond the budget cannot open a message channel.

The SDK is 4.33.1, CLI 5.0.40 and actual Emery QEMU firmware 4.33.2. Native
execution used isolated FIFOs without a phone runtime. `QemuContentSize` changed
the actual OS preference to 1, 2 and 3, with a fresh launch after each change.
Those are Emery Small, Medium and Large, rather than a compile-time size fixture.

| Native run | Evidence under ignored `build/qa/` | Result |
| --- | --- | --- |
| Exact candidate, three OS sizes | `native-sizes-current/report.json` | 28 captures; passive setup, >4s survival, offline setup, saved dark reopening, invalid theme rejection, Back, zero activity handshake, light/dark, complete 12/24h clocks and top/bottom scrolling |
| Czech lookup override | `native-sizes-cs-current/report.json` | Same 28 captures and checks; separate PBW `e28c4f7d5a0074ad0b1fd9375e369b02cf4ae133bbb69e9e129c0a95b86c6ab3` |
| German lookup override | `native-sizes-de-current/report.json` | Same 28 captures and checks; separate PBW `b15304dd31a046f36bd6490a4854e95c642a9c4e0452fe0960d8351dcbf1524d` |
| Repeated candidate setup/Back | `native-cleanup-current/report.json` | 20 additional cycles; every reported exit has zero outstanding allocations |
| Opening reason override, English | `native-opening-en-current/report.json` | All three actual OS sizes; timeout closes; only the expected best-effort Cancel is sent |
| Opening reason override, Czech/German | `native-opening-cs-current/report.json`, `native-opening-de-current/report.json` | Same native composition and timeout checks |

The locale fixtures change the lookup locale, not the installed OS language pack.
The opening fixtures override launch reason/button/gesture in a separate native
build; they do not claim an actual OS Quick Launch gesture. Their PBW hashes are
English `93e78f97a45abc6de0949ce87e276b00f22ae50eb9c7eb3af9f44e0d2ebff6b5`,
Czech `1b19176a7bacb7e826c61158a18128e207fc2f1cd28c5af6b3b16d81faee7e2c`,
German `4145944494091376f8cb0bb05f5907233c5c83b613d073ec3d987767075e06c1`.
Generate these explicitly separate fixtures with `python3 scripts/build-native-reference.py`.

Raw native captures were inspected at all three sizes, including Czech accents,
German wording, light/dark and the opening label. `native-setup-sizes.png` is a
labelled contact sheet of unchanged native pixels. The setup paragraphs fit in
these three locales; Up/Down retain access if longer content needs scrolling.
The build reports 123752 bytes of heap available; repeated setup exits report
1216 bytes of peak use and zero still allocated.

For a repeatable exact-candidate run after building:

```sh
python3 scripts/emulator-smoke.py --native-sizes \
  --expected-sha256 189da4abe63260ed0d3bb27fe228edb0a44c840ff7db3ed71fd38847299f1dfb \
  --output build/qa/native-sizes-current
python3 scripts/emulator-smoke.py --repeat-cycles 20 \
  --output build/qa/native-cleanup-current
```

Manual text-size overrides and confirmed phone preference delivery are a separate
task stage. Current supported firmware and physical paired phone/Time 2 checks
remain pending. On a watch, verify passive normal launch, each assigned Quick
Launch shortcut and provider/role, cancellation, phone disconnect and late source
delivery. Touch navigation remains disabled, matching the previous app.
