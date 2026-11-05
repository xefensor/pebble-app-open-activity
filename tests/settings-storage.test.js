'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const settings = require('../src/pkjs/settings');
const createLauncher = require('../src/pkjs/launcher');
const protocol = require('../src/pkjs/protocol');
const pair = (primary = 'tap-up', secondary = 'combo-up-down') =>
  ({version: 2, primaryShortcut: primary, secondaryShortcut: secondary});

function stores(value = settings.defaults()) {
  // Stock Android restores PKJS DOM storage once, mirrors its writes to native
  // preferences, then replaces those preferences from the DOM during teardown.
  // The config plugin reads/writes native preferences directly.
  const native = new Map([[settings.key, JSON.stringify(value)]]), dom = new Map(native);
  const plugin = {getItem: key => native.get(key) ?? null, setItem: (key, value) => native.set(key, value)};
  const pkjs = {getItem: key => dom.get(key) ?? null, setItem(key, value) {dom.set(key, value); native.set(key, value);}};
  return {native, dom, plugin, pkjs, teardown() {
    const saved = [...dom]; native.clear(); for (const [key, value] of saved) native.set(key, value);
  }};
}
function pluginContext(storage) {
  const file = require.resolve('../src/plugin/index'), requireFile = createRequire(file);
  let handler;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    require: requireFile, localStorage: storage, Pebble: {registerConfigHandler(fn) {handler = fn;}}
  });
  return function(message) {
    let result; handler(message, value => {result = JSON.parse(JSON.stringify(value));});
    assert.notEqual(result, undefined, 'config plugin must answer'); return result;
  };
}
function pkjsContext(storage) {
  const file = require.resolve('../src/pkjs/index'), requireFile = createRequire(file);
  const events = {}, messages = [], subscriptions = [], invocations = [], timers = new Map();
  let launcher, timerId = 0;
  const pebble = {
    addEventListener(name, fn) {events[name] = fn;},
    sendAppMessage(message, success) {messages.push(message); if (success) success();},
    subscribeToSource(request) {subscriptions.push(request); return {unsubscribe() {}};},
    invokeAction(request) {invocations.push(request); return Promise.resolve({ok: true});},
    openURL() {throw new Error('settings messages must not open a page');}
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    localStorage: storage, Pebble: pebble,
    require(name) {
      if (name === './launcher') return options => (launcher = createLauncher({...options,
        now: () => 1793700000000, later(fn, delay) {timers.set(++timerId, {fn, delay}); return timerId;},
        cancelLater(id) {timers.delete(id);}}));
      return requireFile(name);
    }
  });
  return {events, messages, subscriptions, invocations, timers, get launcher() {return launcher;}, receive(message) {
    assert.equal(typeof events.configmessage, 'function', 'PKJS must own live settings messages');
    let result; events.configmessage({data: message, respond(value) {result = JSON.parse(JSON.stringify(value));}});
    assert.notEqual(result, undefined, 'PKJS must answer'); return result;
  }};
}
function inert(context) {
  assert.equal(context.messages.length, 0); assert.equal(context.subscriptions.length, 0);
  assert.equal(context.invocations.length, 0); assert.equal(context.timers.size, 0);
}

test('live PKJS save keeps shortcut choices in Android DOM and native stores through teardown', () => {
  const data = stores(), plugin = pluginContext(data.plugin), pkjs = pkjsContext(data.pkjs), selected = pair();
  // The former plugin-only path acknowledges a write which stale PKJS teardown
  // can undo. Distinct stores are essential to reproducing that boundary.
  assert.equal(plugin({type: 'saveSettings', settings: selected}).ok, true);
  assert.deepEqual(settings.load(data.plugin), selected);
  assert.deepEqual(settings.load(data.pkjs), settings.defaults());
  data.teardown(); assert.deepEqual(settings.load(data.plugin), settings.defaults());

  assert.deepEqual(pkjs.receive({type: 'saveSettings', settings: selected}), {ok: true, settings: selected});
  assert.deepEqual(settings.load(data.pkjs), selected);
  assert.deepEqual(plugin({type: 'getSettings'}).settings, selected);
  data.teardown();
  assert.deepEqual(pluginContext(data.plugin)({type: 'getSettings'}).settings, selected);
  inert(pkjs);
});

test('PKJS and plugin return exact saved choices for both save aliases without navigation', () => {
  for (const kind of ['pkjs', 'plugin']) {
    const data = stores(), context = pkjsContext(data.pkjs);
    const receive = kind === 'pkjs' ? context.receive : pluginContext(data.plugin);
    for (const type of ['saveSettings', 'save_settings']) {
      const selected = type === 'saveSettings' ? pair() : pair('hold-back', 'none');
      assert.deepEqual(receive({type, settings: selected}), {ok: true, settings: selected});
      assert.deepEqual(settings.load(kind === 'pkjs' ? data.pkjs : data.plugin), selected);
    }
    inert(context);
  }
});

test('legacy reads preserve stored bytes and routing until explicit save migrates the choices', () => {
  const old = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'secondary'},
    tapOverrides: {up: 'secondary'}, comboOverrides: {upDown: 'primary'}};
  for (const kind of ['pkjs', 'plugin']) {
    const data = stores(old), encoded = data.plugin.getItem(settings.key), context = pkjsContext(data.pkjs);
    const receive = kind === 'pkjs' ? context.receive : pluginContext(data.plugin);
    for (const type of ['getSettings', 'load_settings']) {
      const response = receive({type});
      assert.deepEqual(response, {ok: true, settings: settings.choices(old), needsRepair: false, needsMigration: true});
      assert.equal(data.plugin.getItem(settings.key), encoded); assert.equal(data.pkjs.getItem(settings.key), encoded);
      for (const shortcut of settings.shortcuts)
        assert.equal(settings.select(settings.load(data.plugin), shortcut.button, shortcut.gesture), settings.select(old, shortcut.button, shortcut.gesture));
    }
    const selected = settings.choices(old);
    assert.deepEqual(receive({type: 'save_settings', settings: old}), {ok: true, settings: selected});
    assert.deepEqual(settings.load(kind === 'pkjs' ? data.pkjs : data.plugin), selected);
    inert(context);
  }
});

test('malformed or conflicting choices never mutate either settings store', () => {
  for (const kind of ['pkjs', 'plugin']) {
    const data = stores(), context = pkjsContext(data.pkjs);
    const receive = kind === 'pkjs' ? context.receive : pluginContext(data.plugin);
    const nativeBefore = [...data.native], domBefore = [...data.dom];
    for (const value of [undefined, null, {}, [], pair('tap-up', 'tap-up'), pair('constructor', 'none'), {...pair(), extra: true}]) {
      assert.deepEqual(receive({type: 'saveSettings', settings: value}), {ok: false});
      assert.deepEqual([...data.native], nativeBefore); assert.deepEqual([...data.dom], domBefore);
    }
    assert.deepEqual(receive({type: 'unknown'}), {ok: false}); inert(context);
  }
});

test('storage exceptions or failed readback cannot produce a successful settings receipt', () => {
  for (const broken of [
    {getItem() {return null;}, setItem() {throw new Error('unavailable');}},
    {getItem() {return null;}, setItem() {}}
  ]) {
    assert.deepEqual(pluginContext(broken)({type: 'saveSettings', settings: pair()}), {ok: false});
    const context = pkjsContext(broken);
    assert.deepEqual(context.receive({type: 'saveSettings', settings: pair()}), {ok: false}); inert(context);
  }
});

test('settings remain available after cancellation without replaying a terminal launch attempt', () => {
  const data = stores(), context = pkjsContext(data.pkjs);
  context.launcher.cancel(); assert.equal(context.launcher.state(), 'closed');
  assert.equal(context.receive({type: 'getSettings'}).ok, true);
  assert.deepEqual(context.receive(JSON.stringify({type: 'save_settings', settings: pair()})), {ok: true, settings: pair()});
  context.events.ready();
  context.events.appmessage({payload: protocol.message(protocol.operation.HELLO,
    {OA_SESSION: 9, OA_BUTTON: 1, OA_GESTURE: protocol.gesture.tap, OA_ELAPSED_MS: 100})});
  context.events.appmessage({payload: protocol.message(protocol.operation.CONFIRM, {OA_SESSION: 9})});
  assert.equal(context.launcher.state(), 'closed'); inert(context);
});
