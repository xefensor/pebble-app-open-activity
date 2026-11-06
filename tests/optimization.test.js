'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const navigation = require('../src/pkjs/navigation');
const page = require('../src/pkjs/settings-page');
const mount = require('./helpers/settings-page');

test('settings coalesces viewport/status/observer work and skips unchanged layout writes', async () => {
  const viewport = {height: 800, actionsHeight: 144};
  const ui = mount(page.config(), () => Promise.resolve({ok: true,
    settings: {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'hold-up'}}), viewport);
  ui.ready(); await ui.tick();
  for (let i = 0; i < 20; i++) ui.resize();
  assert.equal(ui.geometry.reads, 0, 'no synchronous forced layout');
  ui.frame();
  assert.deepEqual(ui.geometry, {reads: 1, attributeWrites: 1, styleWrites: 1});
  for (let i = 0; i < 20; i++) ui.resize();
  ui.frame();
  assert.deepEqual(ui.geometry, {reads: 2, attributeWrites: 1, styleWrites: 1});
  viewport.actionsHeight = 300; ui.resize(); ui.frame();
  assert.equal(ui.elements.actions.attributes['data-flow'], 'true');
  assert.deepEqual(ui.geometry, {reads: 3, attributeWrites: 2, styleWrites: 2});
});

test('oversized navigation input is rejected before walking its characters', () => {
  const original = String.prototype.charCodeAt;
  let reads = 0;
  try {
    String.prototype.charCodeAt = function(index) {reads++; return original.call(this, index);};
    assert.equal(navigation.parseHint('a'.repeat(100000), 1793700000000), null);
    assert.equal(reads, 0);
    assert.equal(navigation.parseHint('é'.repeat(300), 1793700000000), null);
    assert.ok(reads > 0, 'bounded strings still undergo UTF-8 validation');
  } finally {String.prototype.charCodeAt = original;}
});

test('Quick Launch startup does not execute the legacy settings page module', () => {
  const handlers = {}, imports = [], urls = [];
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/pkjs/index'), 'utf8'), {
    Pebble: {addEventListener(name, fn) {handlers[name] = fn;}, openURL(url) {urls.push(url);}},
    localStorage: {},
    require(name) {
      imports.push(name);
      if (name === './launcher') return () => ({ready() {}, message() {}});
      if (name === './ui-settings') return {load: () => ({version: 1, theme: 'light'})};
      if (name === './settings') return {load: () => ({}), defaults: () => ({})};
      assert.equal(name, './settings-page'); return () => '<html>settings</html>';
    }
  });
  handlers.ready(); handlers.appmessage({payload: {}});
  assert.deepEqual(imports, ['./launcher', './settings', './ui-settings']);
  handlers.showConfiguration();
  assert.deepEqual(imports, ['./launcher', './settings', './ui-settings', './settings-page']);
  assert.match(urls[0], /^data:text\/html;charset=utf-8,/);
});
