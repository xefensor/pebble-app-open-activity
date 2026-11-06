'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const navigation = require('../src/pkjs/navigation');
const settings = require('../src/pkjs/settings');
const page = require('../src/pkjs/settings-page');
const NOW = 1793700000000;
const TIMER = '50e9ef12-a5ab-4369-a3b5-3447bfba5151';
const MUSIC = '1f03293d-47af-4f28-b960-f2b02a6dd757';
function hint(changes) {
  return Object.assign({schema: 1, watchfaceUuid: navigation.dynamicUuid, nativeSession: 123,
    viewSequence: 41, presentationSequence: 7, presentedAtMs: NOW - 5000,
    expiresAtMs: NOW + 40000, primary: {watchAppUuid: TIMER}, secondary: {watchAppUuid: MUSIC}}, changes);
}
function envelope(value, changes) {
  return Object.assign({pluginUuid: navigation.dynamicUuid, validUntilMs: value.expiresAtMs,
    instances: [{instanceId: 'current', properties: {hint: {longText: {text: JSON.stringify(value)}}}}]}, changes);
}
test('exact Dynamic source selects either role without content or provider inference', () => {
  assert.deepEqual(navigation.resolve(envelope(hint()), 'primary', NOW), {watchAppUuid: TIMER, expiresAtMs: NOW + 40000});
  assert.deepEqual(navigation.resolve(envelope(hint()), 'secondary', NOW), {watchAppUuid: MUSIC, expiresAtMs: NOW + 40000});
  assert.equal(navigation.resolve(envelope(hint({secondary: null})), 'secondary', NOW), null);
  assert.equal(navigation.resolve(envelope(hint()), 'tertiary', NOW), null);
});
test('source availability and original routing expiry are both enforced', () => {
  const valid = hint();
  assert.equal(navigation.resolve(envelope(valid), 'primary', valid.expiresAtMs), null);
  assert.equal(navigation.resolve(envelope(valid, {validUntilMs: NOW}), 'primary', NOW), null);
  assert.equal(navigation.resolve(envelope(valid, {validUntilMs: valid.expiresAtMs + 1}), 'primary', NOW), null);
  assert.deepEqual(navigation.resolve(envelope(valid, {validUntilMs: NOW + 50}), 'primary', NOW), {watchAppUuid: TIMER, expiresAtMs: NOW + 50});
});
test('wrong provider, missing/duplicate instances and malformed transport close', () => {
  const value = hint();
  assert.equal(navigation.resolve(envelope(value, {pluginUuid: TIMER}), 'primary', NOW), null);
  assert.equal(navigation.resolve(envelope(value, {instances: []}), 'primary', NOW), null);
  const source = envelope(value); source.instances.push(source.instances[0]);
  assert.equal(navigation.resolve(source, 'primary', NOW), null);
  assert.equal(navigation.resolve({pluginUuid: navigation.dynamicUuid}, 'primary', NOW), null);
});
test('hint validator rejects unsupported schema, unknown fields and invalid clocks/counters', () => {
  for (const changes of [
    {schema: 2}, {body: 'private content'}, {watchfaceUuid: TIMER}, {nativeSession: 0},
    {nativeSession: 'old-session'}, {viewSequence: -1}, {presentationSequence: 1.5},
    {presentedAtMs: NOW + 1}, {expiresAtMs: NOW}, {expiresAtMs: NOW + 40001},
    {nativeSession: 4294967296}, {presentedAtMs: null}
  ]) assert.equal(navigation.parseHint(JSON.stringify(hint(changes)), NOW), null, JSON.stringify(changes));
  assert.equal(navigation.parseHint('{broken', NOW), null);
  assert.equal(navigation.parseHint(' '.repeat(513), NOW), null);
});
test('destination objects reject recursion, zero UUID, uppercase, extra args and wrong shapes', () => {
  for (const destination of [
    {watchAppUuid: navigation.helperUuid}, {watchAppUuid: '00000000-0000-0000-0000-000000000000'},
    {watchAppUuid: TIMER.toUpperCase()}, {watchAppUuid: TIMER, args: {timer: 1}},
    {pluginUuid: TIMER}, {}, TIMER, false
  ]) assert.equal(navigation.parseHint(JSON.stringify(hint({primary: destination})), NOW), null);
});
test('byte accounting handles UTF-8 and malformed surrogate text', () => {
  assert.equal(navigation.utf8Bytes('aé😀'), 7);
  assert.equal(navigation.utf8Bytes('\ud800'), Infinity);
  assert.equal(navigation.utf8Bytes('\udc00'), Infinity);
});
test('factory choices bind exactly one shortcut per role and leave other buttons unassigned', () => {
  const storage = {getItem: () => null};
  const saved = settings.load(storage);
  assert.equal(settings.select(saved, 1), 'secondary');
  assert.equal(settings.select(saved, 3), 'primary');
  assert.deepEqual(saved, {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'hold-up'});
  assert.equal(settings.select(saved, 2), null);
  assert.equal(settings.select(saved, 0), null);
  assert.equal(settings.select(saved, 1, 2), null);
  const reversed = settings.normalize({version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'default'}});
  assert.equal(settings.select(reversed, 1), 'primary');
  assert.equal(settings.select(reversed, 3), 'secondary');
  for (const value of ['toString', 'constructor', '__proto__', '1', 9, -1, null]) assert.equal(settings.select(saved, value), null);
});
test('legacy eight-slot settings retain their exact routing across a cold save/load', () => {
  const previous = {version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary', down: 'primary'}};
  let encoded = JSON.stringify(previous), writes = 0;
  const storage = {getItem: () => encoded, setItem(key, value) {assert.equal(key, settings.key); writes++; encoded = value;}};
  assert.deepEqual(settings.load(storage), previous);
  assert.equal(writes, 0, 'opening old settings never writes or changes choices');
  const chosen = {version: 1, defaultRole: 'secondary',
    holdOverrides: {back: 'primary', select: 'secondary', down: 'primary', up: 'secondary'},
    tapOverrides: {down: 'secondary', up: 'primary'}, comboOverrides: {upDown: 'primary', backUp: 'secondary'}};
  assert.equal(settings.save(storage, chosen), true);
  const saved = settings.load(storage);
  assert.deepEqual(Object.keys(saved.holdOverrides), ['up', 'down', 'select', 'back']);
  assert.deepEqual(Object.keys(saved.tapOverrides), ['up', 'down']);
  assert.deepEqual(Object.keys(saved.comboOverrides), ['backUp', 'upDown']);
  for (const [button, gesture, expected] of [
    [0, 1, 'primary'], [1, 1, 'secondary'], [2, 1, 'secondary'], [3, 1, 'primary'],
    [1, 2, 'primary'], [3, 2, 'secondary'], [0, 3, 'secondary'], [1, 3, 'primary']
  ]) assert.equal(settings.select(saved, button, gesture), expected);
  assert.equal(writes, 1);
});
test('new slots inherit Default without changing old hold mappings or adding empty tap state', () => {
  const previous = {version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary', down: 'primary'}};
  const migrated = settings.normalize({...previous,
    holdOverrides: {...previous.holdOverrides, select: 'default', back: 'default'},
    tapOverrides: {up: 'default', down: 'default'}, comboOverrides: {backUp: 'default', upDown: 'default'}});
  assert.deepEqual(migrated, previous);
  for (const [button, gesture] of [[0, 1], [2, 1], [1, 2], [3, 2], [0, 3], [1, 3]])
    assert.equal(settings.select(migrated, button, gesture), 'primary');
  for (const [button, gesture] of [[0, 2], [2, 2], [1, 0], [1, 4], [2, 3], [3, 3], [1, '1'], [1, null]])
    assert.equal(settings.select(migrated, button, gesture), null);
  for (const changes of [{holdOverrides: {other: 'primary'}}, {tapOverrides: {select: 'primary'}},
    {tapOverrides: {back: 'secondary'}}, {tapOverrides: null}, {tapOverrides: []}, {tapOverrides: {up: 'unknown'}},
    {comboOverrides: {back: 'primary'}}, {comboOverrides: {backUp: 'unknown'}}, {comboOverrides: null}])
    assert.equal(settings.normalize({...previous, ...changes}), null);
});
test('each of the eight shortcuts can be chosen for either role without assigning the other seven', () => {
  let encoded, writes = 0;
  const storage = {getItem: () => encoded, setItem(key, value) {assert.equal(key, settings.key); encoded = value; writes++;}};
  assert.equal(settings.shortcuts.length, 8);
  for (const shortcut of settings.shortcuts) for (const chosenRole of ['primary', 'secondary']) {
    const chosen = {version: 2, primaryShortcut: 'none', secondaryShortcut: 'none'};
    chosen[chosenRole + 'Shortcut'] = shortcut.id;
    assert.equal(settings.save(storage, chosen), true);
    const loaded = settings.load(storage);
    assert.deepEqual(loaded, chosen);
    assert.deepEqual(settings.choices(loaded), chosen);
    for (const candidate of settings.shortcuts)
      assert.equal(settings.select(loaded, candidate.button, candidate.gesture), candidate.id === shortcut.id ? chosenRole : null);
  }
  assert.equal(writes, 16);
});
test('two role choices reject collisions and malformed shortcuts while allowing either role to be disabled', () => {
  const original = settings.defaults();
  assert.deepEqual(settings.normalize({secondaryShortcut: 'tap-down', primaryShortcut: 'hold-back', version: 2}),
    {version: 2, primaryShortcut: 'hold-back', secondaryShortcut: 'tap-down'});
  for (const shortcut of settings.shortcuts)
    assert.equal(settings.normalize({version: 2, primaryShortcut: shortcut.id, secondaryShortcut: shortcut.id}), null);
  for (const invalid of [undefined, null, true, 1, {}, [], 'default', '', 'constructor', '__proto__', 'hold-center', 'hold-Up']) {
    assert.equal(settings.normalize({...original, primaryShortcut: invalid}), null);
    assert.equal(settings.normalize({...original, secondaryShortcut: invalid}), null);
  }
  assert.equal(settings.normalize({...original, defaultRole: 'primary'}), null);
  assert.equal(settings.normalize({...original, version: 3}), null);
  const disabled = {version: 2, primaryShortcut: 'none', secondaryShortcut: 'none'};
  assert.deepEqual(settings.normalize(disabled), disabled);
  for (const shortcut of settings.shortcuts) assert.equal(settings.select(disabled, shortcut.button, shortcut.gesture), null);
  assert.deepEqual(settings.normalize({version: 2, primaryShortcut: 'hold-up', secondaryShortcut: 'hold-down'}),
    {version: 2, primaryShortcut: 'hold-up', secondaryShortcut: 'hold-down'});
  for (const [button, gesture] of [[0, 2], [2, 2], [2, 3], [3, 3], [1, 0], [1, null], [1, '1']])
    assert.equal(settings.select(original, button, gesture), null);
});
test('legacy projection prefers existing explicit role shortcuts and never writes until an explicit Save', () => {
  const legacy = {version: 1, defaultRole: 'secondary',
    holdOverrides: {up: 'primary', down: 'secondary', select: 'primary'},
    tapOverrides: {up: 'secondary', down: 'primary'}, comboOverrides: {backUp: 'secondary'}};
  let encoded = JSON.stringify(legacy), writes = 0;
  const storage = {getItem: () => encoded, setItem(key, value) {assert.equal(key, settings.key); encoded = value; writes++;}};
  const loaded = settings.load(storage);
  assert.equal(writes, 0);
  assert.deepEqual(loaded, legacy);
  const projected = settings.choices(loaded);
  assert.deepEqual(projected, {version: 2, primaryShortcut: 'hold-up', secondaryShortcut: 'hold-down'});
  assert.equal(settings.select(loaded, 1, 2), 'secondary', 'legacy extra assignments remain live before Save');
  assert.equal(settings.select(loaded, 3, 2), 'primary');
  assert.equal(settings.save(storage, projected), true);
  assert.equal(writes, 1);
  const saved = settings.load(storage);
  assert.deepEqual(saved, projected);
  assert.equal(settings.select(saved, 1, 1), 'primary');
  assert.equal(settings.select(saved, 3, 1), 'secondary');
  assert.equal(settings.select(saved, 1, 2), null, 'unselected legacy extras stop only after explicit Save');
  assert.equal(settings.select(saved, 3, 2), null);
  assert.deepEqual(settings.choices({version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary', down: 'primary'}}), settings.defaults());
  assert.deepEqual(settings.choices({version: 1, defaultRole: 'primary', holdOverrides: {}}),
    {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'none'});
  assert.deepEqual(settings.choices({version: 1, defaultRole: 'secondary', holdOverrides: {}}),
    {version: 2, primaryShortcut: 'none', secondaryShortcut: 'hold-up'});
  assert.deepEqual(settings.choices({version: 1, defaultRole: 'primary', holdOverrides: {}, comboOverrides: {upDown: 'secondary'}}),
    {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'combo-up-down'});
  assert.equal(settings.choices({version: 3}), null);
});
test('corrupt, inherited-name and unsupported settings never silently become defaults', () => {
  for (const role of ['toString', 'constructor', '__proto__', 'unknown', '', null, 1]) {
    assert.equal(settings.normalize({version: 1, defaultRole: role, holdOverrides: {}}), null);
    assert.equal(settings.normalize({version: 1, defaultRole: 'primary', holdOverrides: {up: role}}), null);
  }
  assert.equal(settings.load({getItem: () => '{broken'}), null);
  assert.equal(settings.load({getItem: () => {throw new Error('storage');}}), null);
  assert.equal(settings.normalize({version: 2, defaultRole: 'primary', holdOverrides: {}}), null);
});
test('settings storage is read-back checked and contains only configuration', () => {
  let encoded;
  const storage = {setItem: (key, value) => {assert.equal(key, settings.key); encoded = value;}, getItem: () => encoded};
  assert.equal(settings.save(storage, settings.defaults()), true);
  assert.deepEqual(JSON.parse(encoded), settings.defaults());
  assert.equal(settings.save({setItem() {}, getItem: () => null}, settings.defaults()), false);
});
test('offline settings explain separate assignment and preserve selected roles', () => {
  const html = page(settings.defaults(), false);
  assert.match(html, /Quick Launch/);
  assert.ok(html.includes(JSON.stringify({mode: 'legacy', settings: settings.defaults(), needsRepair: false, needsMigration: false}).slice(0,-1)));
  assert.match(html, /pebblejs:\/\/close#/);
  assert.doesNotMatch(html, /https?:\/\//);
});
module.exports = {NOW, TIMER, MUSIC, hint, envelope};
