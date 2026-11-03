'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const packageInfo = require('../package.json');
const artifact = path.join(root, 'dist', 'Open-Activity-' + packageInfo.version + '.pbw');
const built = fs.existsSync(artifact);
const protocol = require('../src/pkjs/protocol');
const navigation = require('../src/pkjs/navigation');
const settings = require('../src/pkjs/settings');
const mountSettings = require('./helpers/settings-page');
const NOW = 1793700000000;
const TIMER = '50e9ef12-a5ab-4369-a3b5-3447bfba5151';
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
  return function (message) {
    let result;
    handler(message, value => {result = JSON.parse(JSON.stringify(value));});
    return result;
  };
}
test('packaged config cold-starts without native watchapp and preserves settings across fresh plugin contexts', {skip: !built}, () => {
  const store = storage();
  const first = coldConfig(store);
  assert.deepEqual(first({type: 'getSettings'}), {ok: true, settings: settings.defaults(), needsRepair: false});
  const chosen = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'secondary'}};
  assert.deepEqual(first({type: 'saveSettings', settings: chosen}), {ok: true});
  const second = coldConfig(store);
  assert.deepEqual(second({type: 'getSettings'}), {ok: true, settings: chosen, needsRepair: false});
  assert.deepEqual(Array.from(store.items.keys()), [settings.key]);
  assert.deepEqual(second({type: 'saveSettings', settings: {version: 1, defaultRole: 'constructor', holdOverrides: {}}}), {ok: false});
  assert.deepEqual(coldConfig(store)({type: 'getSettings'}).settings, chosen);
});
test('actual packaged HTML talks only to config plugin and saves without a native session', {skip: !built}, async () => {
  const store = storage();
  const invoke = coldConfig(store);
  const ui = mountSettings(bundle['config.html'], message => Promise.resolve(invoke(message)));
  const elements = ui.elements, requests = ui.requests;
  ui.ready(); await ui.tick();
  assert.equal(elements.up.value, 'secondary');
  assert.equal(elements.down.value, 'primary');
  assert.equal(elements.save.disabled, true);
  ui.change('up', 'primary'); ui.change('down', 'secondary'); ui.change('role', 'secondary');
  elements.save.onclick(); await ui.tick();
  assert.equal(elements.status.textContent, 'Settings saved.');
  assert.equal(requests.length, 2);
  assert.equal(coldConfig(store)({type: 'getSettings'}).settings.holdOverrides.down, 'secondary');
  assert.doesNotMatch(bundle['config.html'], /https?:\/\//);
  assert.deepEqual(JSON.parse(bundle['appinfo.json']).plugin.sources, []);
  assert.deepEqual(JSON.parse(bundle['appinfo.json']).plugin.actions, []);
});
test('packaged legacy configuration shares the page and retains cancel/save return URLs', {skip: !built}, () => {
  const handlers = {}, urls = [], store = storage();
  const chosen = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary'}};
  settings.save(store, chosen);
  vm.runInNewContext(bundle['pebble-js-app.js'], {
    localStorage: store, setTimeout() {return 1;}, clearTimeout() {}, console: {log() {}, error() {}},
    Pebble: {addEventListener(event, handler) {handlers[event] = handler;}, openURL(url) {urls.push(url);}}
  }, {timeout: 2000});
  handlers.showConfiguration();
  const html = decodeURIComponent(urls[0].replace(/^data:text\/html;charset=utf-8,/, ''));
  const ui = mountSettings(html, () => {throw Error('legacy config cannot use the plugin bridge');});
  assert.equal(ui.elements.discard.textContent, 'Cancel'); assert.equal(ui.elements.save.disabled, true);
  assert.equal(ui.elements.up.value, 'primary'); assert.equal(ui.elements.down.value, 'default');
  ui.change('down', 'secondary'); ui.elements.discard.onclick();
  assert.equal(ui.location.href, 'pebblejs://close#');
  assert.deepEqual(settings.load(store), chosen);
  const save = mountSettings(html, () => {throw Error('legacy config cannot use the plugin bridge');});
  save.change('down', 'secondary'); save.elements.save.onclick();
  assert.deepEqual(JSON.parse(decodeURIComponent(save.location.href.split('#')[1])),
    {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'secondary'}});
});
test('packaged PKJS consumes Dynamic nav source and invokes exactly once only after native confirmation', {skip: !built}, () => {
  const handlers = {}, messages = [], invocations = [];
  let subscription;
  const Clock = class extends Date {static now() {return NOW;}};
  vm.runInNewContext(bundle['pebble-js-app.js'], {
    Date: Clock, Math, Promise, localStorage: storage(), console: {error() {}, log() {}},
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
    {OA_SESSION: 9, OA_BUTTON: 3, OA_ELAPSED_MS: 100})});
  assert.equal(subscription.plugin, navigation.dynamicUuid);
  const hint = {schema: 1, watchfaceUuid: navigation.dynamicUuid, nativeSession: 99,
    viewSequence: 41, presentationSequence: 7, presentedAtMs: NOW - 1000,
    expiresAtMs: NOW + 40000, primary: {watchAppUuid: TIMER}, secondary: null};
  subscription.onData({pluginUuid: navigation.dynamicUuid, validUntilMs: hint.expiresAtMs,
    instances: [{instanceId: 'current', properties: {hint: {longText: {text: JSON.stringify(hint)}}}}]});
  const prepare = messages.find(message => protocol.get(message, 'OA_OPERATION') === protocol.operation.PREPARE);
  assert.ok(prepare);
  assert.ok(protocol.get(prepare, 'OA_TICKET') > 0 && protocol.get(prepare, 'OA_TICKET') <= 2147483647);
  assert.equal(invocations.length, 0);
  const confirm = Object.assign({}, prepare, {[protocol.keys.OA_OPERATION]: protocol.operation.CONFIRM,
    [protocol.keys.OA_ELAPSED_MS]: 200});
  handlers.appmessage({payload: confirm}); handlers.appmessage({payload: confirm});
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].args.uuid, TIMER);
  assert.equal(invocations[0].action, 'launch_app');
});
