'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const page = require('../src/pkjs/settings-page');
const settings = require('../src/pkjs/settings');
const mount = require('./helpers/settings-page');
const pair = (primary = 'hold-down', secondary = 'hold-up') => ({version: 2, primaryShortcut: primary, secondaryShortcut: secondary});
const loaded = () => ({ok: true, settings: pair(), needsRepair: false, needsMigration: false});
const legacy = () => ({version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary', down: 'primary', back: 'secondary'}, tapOverrides: {down: 'secondary'}});

test('page offers a watchface, two activity shortcuts and separate appearance', async () => {
  const html = page.config();
  assert.equal(fs.readFileSync(require.resolve('../config.html'), 'utf8'), html);
  assert.equal((html.match(/<select\b/g) || []).length, 4);
  assert.match(html, /Primary activity/); assert.match(html, /Secondary activity/);
  const ui = mount(html, () => Promise.resolve(loaded()));
  ui.ready('pkjs'); assert.equal(ui.requests.length, 0);
  ui.ready(); ui.ready(); await ui.tick();
  assert.equal(ui.requests.length, 1); assert.equal(ui.elements.save.disabled, true);
  assert.equal(ui.elements.primary.value, 'hold-down'); assert.equal(ui.elements.secondary.value, 'hold-up');
  assert.equal(ui.elements.watchface.value, 'dynamic');
  assert.deepEqual(ui.elements.watchface.options.filter(option => option.value).map(option => option.value), ['dynamic', 'halftone']);
  for (const id of ['primary', 'secondary']) {
    assert.deepEqual(ui.elements[id].options.filter(option => option.value).map(option => option.value).sort(),
      ['none', 'hold-up', 'hold-select', 'hold-down', 'hold-back', 'tap-up', 'tap-down', 'combo-back-up', 'combo-up-down'].sort());
  }
  assert.equal(ui.requests.filter(message => message.type === 'saveSettings').length, 0);
});

test('each shortcut can be chosen for either activity and survives Save and a cold reopen', async () => {
  for (const shortcut of ['hold-up', 'hold-select', 'hold-down', 'hold-back', 'tap-up', 'tap-down', 'combo-back-up', 'combo-up-down']) {
    for (const role of ['primary', 'secondary']) {
      let stored = pair('none', 'none');
      const reply = message => {
        if (message.type === 'getSettings') return Promise.resolve({ok: true, settings: stored});
        stored = JSON.parse(JSON.stringify(message.settings)); return Promise.resolve({ok: true});
      };
      const ui = mount(page.config(), reply); ui.ready(); await ui.tick();
      ui.change(role, shortcut); ui.elements.save.onclick(); await ui.tick();
      assert.equal(stored[role + 'Shortcut'], shortcut);
      assert.equal(stored[(role === 'primary' ? 'secondary' : 'primary') + 'Shortcut'], 'none');
      const reopened = mount(page.config(), reply); reopened.ready(); await reopened.tick();
      assert.equal(reopened.elements[role].value, shortcut); assert.equal(reopened.elements.save.disabled, true);
    }
  }
});
test('watchface changes share confirmed Save, Discard and cold reopening with shortcut choices', async () => {
  let stored = pair();
  const reply = message => {
    if (message.type === 'saveSettings') stored = JSON.parse(JSON.stringify(message.settings));
    return Promise.resolve({ok: true, settings: stored});
  };
  const ui = mount(page.config(), reply);
  assert.equal(ui.elements.watchface.disabled, true);
  ui.ready(); await ui.tick();
  assert.equal(ui.elements.watchface.disabled, false);
  ui.change('watchface', 'halftone');
  assert.equal(ui.elements.save.disabled, false); assert.deepEqual(stored, pair());
  ui.elements.discard.onclick(); assert.equal(ui.elements.watchface.value, 'dynamic');
  assert.equal(ui.elements.save.disabled, true);
  ui.change('watchface', 'halftone'); ui.elements.save.onclick();
  assert.equal(ui.elements.watchface.disabled, true); await ui.tick();
  assert.deepEqual(stored, {...pair(), watchface: 'halftone'});
  assert.equal(ui.elements.status.textContent, '✓ Saved');
  const reopened = mount(page.config(), reply); reopened.ready(); await reopened.tick();
  assert.equal(reopened.elements.watchface.value, 'halftone'); assert.equal(reopened.elements.save.disabled, true);
  reopened.change('primary', 'tap-down'); reopened.elements.save.onclick(); await reopened.tick();
  assert.deepEqual(stored, {...pair('tap-down'), watchface: 'halftone'});
  reopened.change('watchface', 'dynamic'); reopened.elements.save.onclick(); await reopened.tick();
  assert.deepEqual(stored, pair('tap-down'));
  const legacy = mount(page({...pair(), watchface: 'halftone'}, false), () => {throw Error('legacy');});
  assert.equal(legacy.elements.watchface.value, 'halftone');
  legacy.change('primary', 'tap-down'); legacy.elements.save.onclick();
  assert.deepEqual(JSON.parse(decodeURIComponent(legacy.location.href.split('#')[1])).settings,
    {...pair('tap-down'), watchface: 'halftone'});
});

test('a duplicate shortcut blocks Save without clearing either choice; None can disable both', async () => {
  const ui = mount(page.config(), () => Promise.resolve(loaded())); ui.ready(); await ui.tick();
  ui.change('primary', 'hold-up');
  assert.equal(ui.elements.secondary.value, 'hold-up'); assert.equal(ui.elements.primary.value, 'hold-up');
  assert.equal(ui.elements.save.disabled, true);
  assert.equal(ui.elements.status.textContent, 'Choose a different shortcut for each activity.');
  assert.equal(ui.elements['shortcut-error'].hidden, false);
  assert.equal(ui.elements['shortcut-error'].textContent, 'Choose a different shortcut for each activity.');
  assert.equal(ui.elements.primary.attributes['aria-invalid'], 'true');
  assert.equal(ui.elements.secondary.attributes['aria-invalid'], 'true');
  assert.equal(ui.elements['assignment-help'].hidden, true);
  ui.elements.save.onclick(); assert.equal(ui.requests.filter(m => m.type === 'saveSettings').length, 0);
  ui.change('secondary', 'hold-down'); assert.equal(ui.elements.save.disabled, false, 'swapping resolves the conflict');
  assert.equal(ui.elements['shortcut-error'].hidden, true);
  assert.equal(ui.elements.primary.attributes['aria-invalid'], 'false');
  assert.equal(ui.elements['assignment-help'].hidden, false);
  ui.change('primary', 'none'); ui.change('secondary', 'none'); assert.equal(ui.elements.save.disabled, false);
});

test('setup guidance names only the selected shortcuts and explains the disabled state', async () => {
  const ui = mount(page.config(), () => Promise.resolve(loaded())); ui.ready(); await ui.tick();
  assert.equal(ui.elements['assignment-help'].textContent,
    'In Pebble’s Quick Launch settings, assign Open Activity to Hold Down and Hold Up.');
  ui.change('primary', 'combo-back-up'); ui.change('secondary', 'tap-down');
  assert.match(ui.elements['assignment-help'].textContent, /Hold Back \+ Up and Tap Down/);
  ui.change('primary', 'none');
  assert.match(ui.elements['assignment-help'].textContent, /to Tap Down\.$/);
  ui.change('secondary', 'none');
  assert.match(ui.elements['assignment-help'].textContent, /No activity shortcut is enabled/);
});

test('old mappings are projected without writes and converted only by explicit Save', async () => {
  let stored = legacy(); const original = JSON.stringify(stored);
  const ui = mount(page.config(), message => {
    if (message.type === 'getSettings') return Promise.resolve({ok: true, settings: settings.choices(stored), needsMigration: stored.version === 1});
    stored = JSON.parse(JSON.stringify(message.settings)); return Promise.resolve({ok: true, settings: stored});
  });
  ui.ready(); await ui.tick();
  assert.equal(JSON.stringify(stored), original);
  assert.equal(ui.elements.primary.value, 'hold-down'); assert.equal(ui.elements.secondary.value, 'hold-up');
  assert.equal(ui.elements.save.disabled, false); assert.equal(ui.elements.status.textContent, 'Save to use these two shortcuts.');
  ui.elements.save.onclick(); await ui.tick();
  assert.deepEqual(stored, pair()); assert.equal(ui.elements.save.disabled, true);
});

test('malformed and timed-out loading keeps choices disabled and ignores replies after Retry', async () => {
  let resolve, bad = true;
  const ui = mount(page.config(), () => bad ? new Promise(done => {resolve = done;}) : Promise.resolve(loaded()));
  ui.ready(); ui.timeout();
  assert.equal(ui.elements.retry.hidden, false); assert.equal(ui.elements.save.disabled, true);
  bad = false; ui.elements.retry.onclick(); await ui.tick();
  ui.change('primary', 'tap-down');
  resolve({ok: true, settings: pair('hold-select', 'hold-back')}); await ui.tick();
  assert.equal(ui.elements.primary.value, 'tap-down'); assert.equal(ui.elements.secondary.value, 'hold-up');
  const malformed = mount(page.config(), () => Promise.resolve({ok: true, settings: {version: 2}}));
  malformed.ready(); await malformed.tick();
  assert.equal(malformed.elements.save.disabled, true); assert.equal(malformed.elements.retry.hidden, false);
});

test('failed Save retains choices, retry confirms, and ordinary Discard never writes or reads storage', async () => {
  let stored = pair(), fail = true;
  const ui = mount(page.config(), message => {
    if (message.type === 'getSettings') return Promise.resolve({ok: true, settings: stored});
    if (fail) return Promise.reject(Error('bridge'));
    stored = JSON.parse(JSON.stringify(message.settings)); return Promise.resolve({ok: true, settings: stored});
  });
  ui.ready(); await ui.tick(); ui.change('primary', 'hold-back'); ui.elements.save.onclick(); await ui.tick();
  assert.equal(ui.elements.primary.value, 'hold-back'); assert.equal(ui.elements.save.disabled, false);
  assert.equal(ui.elements.discard.textContent, 'Reload saved'); assert.match(ui.elements.status.textContent, /not confirmed/);
  assert.equal(stored.primaryShortcut, 'hold-down');
  fail = false; ui.elements.save.onclick(); await ui.tick();
  assert.equal(ui.elements.status.textContent, '✓ Saved'); assert.equal(ui.elements.save.disabled, true);
  ui.change('secondary', 'tap-up'); ui.elements.discard.onclick(); await ui.tick();
  assert.equal(ui.elements.secondary.value, 'hold-up'); assert.equal(ui.elements.save.disabled, true);
  assert.equal(ui.requests.filter(message => message.type === 'getSettings').length, 1);
  assert.equal(ui.requests.filter(message => message.type === 'saveSettings').length, 2);
});

test('an unconfirmed write is explicitly read back and late replies cannot overwrite a later draft', async () => {
  let stored = pair(), acknowledge;
  const ui = mount(page.config(), message => {
    if (message.type === 'getSettings') return Promise.resolve({ok: true, settings: stored});
    stored = JSON.parse(JSON.stringify(message.settings)); return new Promise(resolve => {acknowledge = resolve;});
  });
  ui.ready(); await ui.tick(); ui.change('primary', 'combo-back-up'); ui.elements.save.onclick(); ui.elements.save.onclick();
  assert.equal(ui.requests.filter(m => m.type === 'saveSettings').length, 1);
  ui.timeout(); assert.equal(ui.elements.discard.textContent, 'Reload saved');
  ui.change('primary', 'hold-down'); assert.equal(ui.elements.save.disabled, false);
  ui.elements.discard.onclick(); await ui.tick();
  assert.equal(ui.elements.primary.value, 'combo-back-up'); assert.equal(ui.elements.status.textContent, 'Saved settings reloaded.');
  ui.change('secondary', 'tap-up'); acknowledge({ok: true}); await ui.tick();
  assert.equal(ui.elements.secondary.value, 'tap-up'); assert.equal(ui.elements.save.disabled, false);
  assert.equal(ui.requests.filter(m => m.type === 'saveSettings').length, 1);
});

test('repair and legacy migration need explicit Save; Cancel writes nothing', () => {
  const ui = mount(page(pair(), true), () => {throw Error('legacy cannot use plugin');});
  assert.equal(ui.elements.save.disabled, false); assert.match(ui.elements.status.textContent, /before saving/);
  ui.change('primary', 'tap-down'); ui.elements.discard.onclick(); assert.equal(ui.location.href, 'pebblejs://close#');
  assert.equal(ui.requests.length, 0);
  const cancel = mount(page(legacy(), false), () => {throw Error('legacy cannot use plugin');});
  assert.equal(cancel.elements.primary.value, 'hold-down'); assert.equal(cancel.elements.save.disabled, false);
  cancel.elements.discard.onclick(); assert.equal(cancel.location.href, 'pebblejs://close#');
  const save = mount(page(legacy(), false), () => {throw Error('legacy cannot use plugin');});
  save.change('primary', 'tap-down'); save.change('secondary', 'combo-up-down'); save.elements.save.onclick();
  assert.deepEqual(JSON.parse(decodeURIComponent(save.location.href.split('#')[1])).settings, pair('tap-down', 'combo-up-down'));
});

test('appearance changes save in the same draft and confirmed Save stays open until a new edit', async () => {
  let stored = pair(), appearance = {version: 1, theme: 'light'};
  const reply = message => {
    if (message.type === 'saveSettings') {
      stored = JSON.parse(JSON.stringify(message.settings)); appearance = JSON.parse(JSON.stringify(message.appearance));
    }
    return Promise.resolve({ok: true, settings: stored, appearance});
  };
  const ui = mount(page.config(), reply); ui.ready(); await ui.tick();
  assert.equal(ui.elements['watch-theme'].value, 'light'); assert.equal(ui.elements['watch-theme'].disabled, false);
  ui.change('watch-theme', 'dark'); assert.equal(ui.elements.status.textContent, 'Unsaved changes.');
  ui.elements.save.onclick(); await ui.tick();
  assert.equal(ui.location.href, '', 'confirmed Save does not navigate or close');
  assert.equal(ui.elements.status.textContent, '✓ Saved'); assert.equal(ui.elements.save.disabled, true);
  assert.deepEqual(appearance, {version: 1, theme: 'dark'});
  const reopened = mount(page.config(), reply); reopened.ready(); await reopened.tick();
  assert.equal(reopened.elements['watch-theme'].value, 'dark'); assert.equal(reopened.elements.save.disabled, true);
  ui.change('primary', 'tap-down'); assert.equal(ui.elements.status.textContent, 'Unsaved changes.');
});
