# Open Activity UI and UX review

Version 0.1.6 fixes access to phone settings. Opening from the ordinary watch app
list now shows setup instructions and a standard clock until Back. It creates
no native opening attempt, while valid Quick Launch retains its four-second
transition and failure-close behavior. Phone settings still have exactly two
choices and preserve ordinary focus. Active/closed save ownership and exact
acknowledgments prevent Android's old runtime snapshot replacing saved choices.
See [0.1.6 evidence](qa/0.1.6). The earlier review below retains its historical
scope, including the previous ordinary-launch closure.

Version 0.1.4 keeps exactly two choices: a shortcut for Primary activity and a
shortcut for Secondary activity. It improves the existing flows without adding
configuration fields or changing routing, permissions or native timing.

| Finding | Change | Evidence |
| --- | --- | --- |
| On a 320×360 viewport, focusing Secondary left its entire field behind the fixed action area | Actions return to document flow on short viewports; regular screens retain the fixed actions | [Before/after geometry](qa/0.1.4/accessibility-comparison.json) and actual focused-field captures |
| Enlarged text could outgrow the fixed space reserved below the form | Reserve the measured action height; move oversized actions into document flow and use full-width buttons there | 32px text, 48px oversized text, and 160×400 CSS viewport checks |
| A conflicting shortcut was explained only in the bottom status area | Show an inline explanation beside the two fields, mark both fields invalid and associate that description with each field | Conflict capture, source tests and actual packaged browser checks |
| Setup copy required matching the chosen shortcuts to generic instructions | Name the currently selected shortcuts in the assignment instruction; explain when neither role is assigned | Source tests and normal/error captures |
| Footer labels repeated context and wrapped unnecessarily | Use Save and Discard; retain Reload saved when a write is unconfirmed | Phone-sized and keyboard action captures |

The duplicate-selection explanation remains available through the live status
area. Generic assignment copy is hidden during a conflict to avoid a third
instruction saying the same thing. The other field is never cleared or changed
automatically.

The pass covers fresh defaults, custom selections, both roles disabled,
conflicts and swaps, old-setting conversion, loading failures, Retry, unsaved
edits, Save, failed and unconfirmed writes, explicit readback, ordinary Discard
and legacy Cancel/Save return URLs. Existing preferences are not written on load.
All eight shortcut identities remain available in each of the two dropdowns.

Native ordinary-launch closure, the four-second initial budget, Back,
disconnection and single-launch confirmation were reviewed against production
code and the existing harnesses. The brief Opening screen remains unchanged;
this helper is still the automatic transition app requested by the user.

Verification uses actual packaged HTML/config plugin in installed Chromium,
isolated SDK/storage fixtures, portable native harnesses and exact native
identity checks. Short viewport and zoom-equivalent checks include real Tab
navigation to Save. The 160×400 CSS viewport models reflow at 200% zoom on a
320×800 display; injected 32px/48px text is recorded separately. These are not
physical-phone keyboard or WebView results. Device launch latency and battery
remain separate checks. See [validation](VALIDATION.md) for exact artifacts.


## 0.2.0 shared UI candidate

The setup screen uses Roboto Condensed, a short violet title, local time on the
right, a readable instruction block and quiet context below. A cached light/dark
palette is restored before phone data. The public appearance-only inbox does not
create a navigation session or handshake; normal setup outlives four seconds.

Phone settings use the shared 512px neutral shell and violet accent with English
and Czech copy. The bundled route remains open with inline ✓ Saved until edited.
Watch appearance is independent of shortcut routing and the phone page theme.
Explicit rejection, unknown outcomes and readback are distinct. Packaged tests
exercise separate Android stores through teardown/reopen; the legacy return-URL
path remains save-and-close with visible help.
