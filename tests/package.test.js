'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const packageInfo = require('../package.json');
const artifact = path.resolve(process.env.PEBBLE_PBW || path.join(root, 'build/candidate', 'Open-Activity-' + packageInfo.version + '.pbw'));
const built = fs.existsSync(artifact);
const protocol = require('../src/pkjs/protocol');
const navigation = require('../src/pkjs/navigation');
const settings = require('../src/pkjs/settings');
const mountSettings = require('./helpers/settings-page');
const NOW = 1793700000000;
const TIMER = '50e9ef12-a5ab-4369-a3b5-3447bfba5151';
const MUSIC = '1f03293d-47af-4f28-b960-f2b02a6dd757';
const slots = [
  [0, 1, 'hold-back', 'back'], [1, 1, 'hold-up', 'up'], [2, 1, 'hold-select', 'select'], [3, 1, 'hold-down', 'down'],
  [1, 2, 'tap-up', 'up'], [3, 2, 'tap-down', 'down'], [0, 3, 'combo-back-up', 'backUp'], [1, 3, 'combo-up-down', 'upDown']
];
const pair = (primary = 'hold-down', secondary = 'hold-up') => ({version: 2, primaryShortcut: primary, secondaryShortcut: secondary});
let bundle;
if (built) bundle = JSON.parse(cp.execFileSync('python3', ['-c',
  'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z: print(json.dumps({name:z.read(name).decode() for name in ["appinfo.json","pebble-js-app.js","plugin.js","config.html"]}))', artifact], {encoding: 'utf8'}));
function storage() {
  const items = new Map();
  return {items, getItem: key => items.has(key) ? items.get(key) : null, setItem: (key, value) => items.set(key, value)};
}
function coldConfig(store) {
  let handler;
  vm.runInNewContext(bundle['plugin.js'], {
    Pebble: {registerConfigHandler(fn) {handler = fn;}}, localStorage: store
  }, {timeout: 2000});
  assert.equal(typeof handler, 'function');
  return function(message) {
    let result; handler(message, value => {result = JSON.parse(JSON.stringify(value));}); return result;
  };
}
function packagedLaunch(chosen, button, gesture) {
  const store = storage(); store.setItem(settings.key, JSON.stringify(chosen));
  const handlers = {}, messages = [], invocations = [];
  let subscription;
  const Clock = class extends Date {static now() {return NOW;}};
  vm.runInNewContext(bundle['pebble-js-app.js'], {
    Date: Clock, Math, Promise, localStorage: store, console: {error() {}, log() {}},
    setTimeout() {return 1;}, clearTimeout() {},
    Pebble: {
      addEventListener(event, handler) {handlers[event] = handler;}, removeEventListener() {},
      sendAppMessage(message, success) {messages.push(message); if (success) success();},
      subscribeToSource(request) {subscription = request; return {unsubscribe() {}};},
      invokeAction(request) {invocations.push(request); return new Promise(() => {});},
      openURL() {throw new Error('unexpected configuration request');}
    }
  }, {timeout: 2000});
  handlers.ready();
  handlers.appmessage({payload: protocol.message(protocol.operation.HELLO,
    {OA_SESSION: 9, OA_BUTTON: button, OA_GESTURE: gesture, OA_ELAPSED_MS: 100})});
  return {messages, invocations, subscription,
    confirm() {
      const watchfaceUuid = chosen.watchface === 'halftone' ? navigation.halftoneUuid : navigation.dynamicUuid;
      assert.equal(subscription.plugin, watchfaceUuid);
      const hint = {schema: 1, watchfaceUuid, nativeSession: 99,
        viewSequence: 41, presentationSequence: 7, presentedAtMs: NOW - 1000,
        expiresAtMs: NOW + 40000, primary: {watchAppUuid: TIMER}, secondary: {watchAppUuid: MUSIC}};
      subscription.onData({pluginUuid: watchfaceUuid, validUntilMs: hint.expiresAtMs,
        instances: [{instanceId: 'current', properties: {hint: {longText: {text: JSON.stringify(hint)}}}}]});
      const prepare = messages.find(message => protocol.get(message, 'OA_OPERATION') === protocol.operation.PREPARE);
      assert.ok(prepare); assert.ok(protocol.get(prepare, 'OA_TICKET') > 0 && protocol.get(prepare, 'OA_TICKET') <= 2147483647);
      assert.equal(invocations.length, 0);
      const confirm = Object.assign({}, prepare, {[protocol.keys.OA_OPERATION]: protocol.operation.CONFIRM,
        [protocol.keys.OA_ELAPSED_MS]: 200});
      handlers.appmessage({payload: confirm}); handlers.appmessage({payload: confirm});
    }
  };
}

test('packaged config stores shortcut and watchface choices across fresh plugin contexts', {skip: !built}, () => {
  const store = storage(), first = coldConfig(store);
  const initial = first({type: 'getSettings'});
  assert.deepEqual(initial.settings, pair()); assert.equal(initial.needsRepair, false); assert.equal(!!initial.needsMigration, false);
  assert.equal(store.items.size, 0, 'reading defaults never writes');
  const chosen = {...pair('combo-back-up', 'tap-down'), watchface: 'halftone'};
  assert.deepEqual(first({type: 'saveSettings', settings: chosen}), {ok: true, settings: chosen});
  const second = coldConfig(store); assert.deepEqual(second({type: 'getSettings'}).settings, chosen);
  assert.deepEqual(Array.from(store.items.keys()), [settings.key]);
  assert.deepEqual(second({type: 'saveSettings', settings: pair('tap-down', 'tap-down')}), {ok: false});
  assert.deepEqual(second({type: 'saveSettings', settings: pair('constructor', 'none')}), {ok: false});
  assert.deepEqual(coldConfig(store)({type: 'getSettings'}).settings, chosen);
});

test('packaged old settings are projected without a write and convert only on an explicit Save', {skip: !built}, () => {
  const store = storage();
  const old = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'secondary'}, tapOverrides: {up: 'secondary'}};
  const encoded = JSON.stringify(old); store.setItem(settings.key, encoded);
  const config = coldConfig(store), loaded = config({type: 'getSettings'});
  assert.deepEqual(loaded.settings, settings.choices(old)); assert.equal(loaded.needsMigration, true);
  assert.equal(store.getItem(settings.key), encoded);
  assert.deepEqual(config({type: 'saveSettings', settings: loaded.settings}), {ok: true, settings: loaded.settings});
  assert.deepEqual(JSON.parse(store.getItem(settings.key)), settings.choices(old));
  assert.equal(!!coldConfig(store)({type: 'getSettings'}).needsMigration, false);
});

test('actual packaged HTML saves watchface and role selectors without a native session', {skip: !built}, async () => {
  assert.equal((bundle['config.html'].match(/<select\b/g) || []).length, 5);
  const store = storage(), invoke = coldConfig(store);
  const ui = mountSettings(bundle['config.html'], message => Promise.resolve(invoke(message)));
  ui.ready(); await ui.tick();
  assert.equal(ui.elements.primary.value, 'hold-down'); assert.equal(ui.elements.secondary.value, 'hold-up');
  assert.equal(ui.elements.save.disabled,false,'fresh display defaults require verified phone Save');
  ui.change('primary', 'combo-back-up'); ui.change('secondary', 'tap-down');
  ui.change('watchface', 'halftone');
  ui.elements.save.onclick(); await ui.tick();
  assert.equal(ui.elements.status.textContent, '✓ Saved'); assert.equal(ui.requests.length, 2);
  const saved = coldConfig(store)({type: 'getSettings'}).settings;
  assert.deepEqual(saved, {...pair('combo-back-up', 'tap-down'), watchface: 'halftone'});
  const attempt = packagedLaunch(saved, 3, 2); attempt.confirm();
  assert.equal(attempt.invocations.length, 1); assert.equal(attempt.invocations[0].args.uuid, MUSIC);
  assert.doesNotMatch(bundle['config.html'], /https?:\/\//);
  assert.deepEqual(JSON.parse(bundle['appinfo.json']).plugin.sources, []);
  assert.deepEqual(JSON.parse(bundle['appinfo.json']).plugin.actions, []);
});

test('packaged legacy configuration shares watchface and shortcuts and retains return URLs', {skip: !built}, () => {
  const handlers = {}, urls = [], store = storage();
  const chosen = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary'}};
  settings.save(store, chosen);
  vm.runInNewContext(bundle['pebble-js-app.js'], {
    localStorage: store, setTimeout() {return 1;}, clearTimeout() {}, console: {log() {}, error() {}},
    Pebble: {addEventListener(event, handler) {handlers[event] = handler;}, openURL(url) {urls.push(url);}}
  }, {timeout: 2000});
  handlers.showConfiguration();
  const html = decodeURIComponent(urls[0].replace(/^data:text\/html;charset=utf-8,/, ''));
  assert.equal((html.match(/<select\b/g) || []).length, 5);
  const ui = mountSettings(html, () => {throw Error('legacy config cannot use plugin bridge');});
  const projected = settings.choices(chosen);
  assert.equal(ui.elements.discard.textContent, 'Cancel'); assert.equal(ui.elements.save.disabled, false);
  assert.equal(ui.elements.primary.value, projected.primaryShortcut); assert.equal(ui.elements.secondary.value, projected.secondaryShortcut);
  ui.change('primary', 'combo-back-up'); ui.elements.discard.onclick();
  assert.equal(ui.location.href, 'pebblejs://close#'); assert.deepEqual(settings.load(store), chosen);
  const save = mountSettings(html, () => {throw Error('legacy config cannot use plugin bridge');});
  save.change('primary', 'combo-back-up'); save.change('secondary', 'tap-down'); save.elements.save.onclick();
  assert.deepEqual(JSON.parse(decodeURIComponent(save.location.href.split('#')[1])).settings, pair('combo-back-up', 'tap-down'));
});

test('packaged PKJS opens either role from any chosen shortcut once and closes unassigned shortcuts', {skip: !built}, () => {
  for (const watchface of ['dynamic', 'halftone']) for (const [button, gesture, id] of slots) {
    for (const role of ['primary', 'secondary']) {
      const chosen = pair('none', 'none'); chosen[role + 'Shortcut'] = id;
      if (watchface === 'halftone') chosen.watchface = watchface;
      const attempt = packagedLaunch(chosen, button, gesture); attempt.confirm();
      assert.equal(attempt.invocations.length, 1);
      assert.equal(attempt.invocations[0].args.uuid, role === 'primary' ? TIMER : MUSIC);
      assert.equal(attempt.invocations[0].action, 'launch_app');
    }
    const disabled = packagedLaunch(pair('none', 'none'), button, gesture);
    assert.equal(disabled.subscription, undefined); assert.equal(disabled.invocations.length, 0);
    assert.ok(disabled.messages.some(message => protocol.get(message, 'OA_OPERATION') === protocol.operation.CLOSE));
  }
  const hold = packagedLaunch(pair('hold-down', 'hold-up'), 3, 2);
  assert.equal(hold.subscription, undefined, 'a Down tap never borrows the Down hold mapping');
});

test('packaged PKJS keeps every old mapping active until a new two-choice configuration is saved', {skip: !built}, () => {
  for (const [button, gesture, , key] of slots) {
    for (const role of ['primary', 'secondary']) {
      const chosen = {version: 1, defaultRole: role === 'primary' ? 'secondary' : 'primary', holdOverrides: {}};
      if (gesture === protocol.gesture.hold) chosen.holdOverrides[key] = role;
      else if (gesture === protocol.gesture.tap) chosen.tapOverrides = {[key]: role};
      else chosen.comboOverrides = {[key]: role};
      const attempt = packagedLaunch(chosen, button, gesture); attempt.confirm();
      assert.equal(attempt.invocations.length, 1); assert.equal(attempt.invocations[0].args.uuid, role === 'primary' ? TIMER : MUSIC);
    }
  }
});
