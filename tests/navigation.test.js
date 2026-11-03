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
test('factory defaults, independent overrides and default hold buttons', () => {
  const storage = {getItem: () => null};
  const saved = settings.load(storage);
  assert.equal(settings.select(saved, 1), 'secondary');
  assert.equal(settings.select(saved, 3), 'primary');
  assert.equal(settings.select(saved, 2), 'primary');
  const reversed = settings.normalize({version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'default'}});
  assert.equal(settings.select(reversed, 1), 'primary');
  assert.equal(settings.select(reversed, 3), 'secondary');
  for (const value of ['toString', 'constructor', '__proto__', '1', 9, -1, null]) assert.equal(settings.select(saved, value), null);
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
  assert.ok(html.includes(JSON.stringify({mode: 'legacy', settings: settings.defaults(), needsRepair: false})));
  assert.match(html, /pebblejs:\/\/close#/);
  assert.doesNotMatch(html, /https?:\/\//);
});
module.exports = {NOW, TIMER, MUSIC, hint, envelope};
