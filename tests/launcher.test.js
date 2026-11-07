'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const createLauncher = require('../src/pkjs/launcher');
const protocol = require('../src/pkjs/protocol');
const navigation = require('../src/pkjs/navigation');
const settings = require('../src/pkjs/settings');
const op = protocol.operation;
const NOW = 1793700000000;
const TIMER = '50e9ef12-a5ab-4369-a3b5-3447bfba5151';
const MUSIC = '1f03293d-47af-4f28-b960-f2b02a6dd757';
function source(changes, watchfaceUuid = navigation.dynamicUuid) {
  const hint = Object.assign({schema: 1, watchfaceUuid, nativeSession: 12,
    viewSequence: 41, presentationSequence: 7, presentedAtMs: NOW - 5000,
    expiresAtMs: NOW + 40000, primary: {watchAppUuid: TIMER}, secondary: {watchAppUuid: MUSIC}}, changes);
  return {pluginUuid: watchfaceUuid, validUntilMs: hint.expiresAtMs,
    instances: [{instanceId: 'current', properties: {hint: {longText: {text: JSON.stringify(hint)}}}}]};
}
function rig(options = {}) {
  let time = NOW, subscription, unsubscribed = 0;
  const timers = new Map(), messages = [], invocations = [], queued = [];
  let nextTimer = 0;
  const pebble = {
    sendAppMessage(message, success, failure) {
      messages.push(message);
      if (options.delayTransport) queued.push({success, failure});
      else success();
    },
    subscribeToSource(request) {
      subscription = request;
      if (options.synchronousData) request.onData(options.synchronousData);
      if (options.sourceThrows) throw new Error('source');
      return {unsubscribe() {unsubscribed++;}};
    },
    invokeAction(request) {
      invocations.push(request);
      if (options.invokeThrows) throw new Error('dispatch');
      return options.result === undefined ? new Promise(() => {}) : Promise.resolve(options.result);
    }
  };
  if (options.noSdk) delete pebble.subscribeToSource;
  const launcher = createLauncher({
    pebble, storage: {getItem: () => options.encodedSettings === undefined ? null : options.encodedSettings,
      setItem() {throw new Error('launcher must not persist anything');}},
    now: () => time, ticket: () => 777,
    later(fn, delay) {const id = ++nextTimer; timers.set(id, {fn, at: time + delay}); return id;},
    cancelLater(id) {timers.delete(id);}
  });
  return {
    launcher, messages, invocations, queued,
    get subscription() {return subscription;},
    get unsubscribed() {return unsubscribed;},
    hello(button = 3, elapsed = 10, gesture = protocol.gesture.hold) {
      launcher.ready();
      launcher.message(protocol.message(op.HELLO, {OA_SESSION: 42, OA_BUTTON: button, OA_GESTURE: gesture, OA_ELAPSED_MS: elapsed}));
    },
    data(envelope = source()) {subscription.onData(envelope);},
    error() {subscription.onError({code: 'UNAVAILABLE'});},
    prepare() {return messages.find(message => protocol.get(message, 'OA_OPERATION') === op.PREPARE);},
    confirm(changes = {}) {
      const message = Object.assign({}, this.prepare(), changes);
      message[protocol.keys.OA_OPERATION] = op.CONFIRM;
      if (message[protocol.keys.OA_ELAPSED_MS] === undefined) message[protocol.keys.OA_ELAPSED_MS] = 100;
      launcher.message(message);
    },
    advance(ms, runTimers = true) {
      time += ms;
      if (runTimers) for (const [id, timer] of Array.from(timers)) {
        if (timer.at <= time) {timers.delete(id); timer.fn();}
      }
    }
  };
}
test('one startup request, exact source, no dispatch before native confirmation', () => {
  const app = rig(); app.hello();
  app.launcher.ready();
  assert.equal(app.messages.filter(x => protocol.get(x, 'OA_OPERATION') === op.REQUEST).length, 1);
  assert.equal(app.subscription.plugin, navigation.dynamicUuid);
  assert.deepEqual(app.subscription.properties, ['hint']);
  assert.equal(app.subscription.category, 'navigation');
  assert.equal(app.subscription.item, 'presented_activities');
  app.data();
  assert.equal(app.unsubscribed, 1);
  assert.equal(app.invocations.length, 0);
  assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), TIMER);
  app.confirm(); app.confirm();
  assert.equal(app.invocations.length, 1);
  assert.deepEqual(app.invocations[0].args, {uuid: TIMER});
  assert.equal(app.invocations[0].plugin, '00000000-0000-0000-0001-000000000007');
  assert.equal(app.invocations[0].action, 'launch_app');
  assert.ok(app.invocations[0].timeoutMs > 0 && app.invocations[0].timeoutMs <= 4000);
});
test('Up chooses Secondary; an absent Secondary closes without Primary fallback', () => {
  const app = rig(); app.hello(1); app.data();
  assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), MUSIC);
  const empty = rig(); empty.hello(1); empty.data(source({secondary: null}));
  assert.equal(empty.launcher.state(), 'closed');
  assert.equal(empty.invocations.length, 0);
  assert.equal(empty.prepare(), undefined);
});
test('Halftone choice opens the exact role once, without borrowing Dynamic data', () => {
  const chosen = {...settings.defaults(), watchface: 'halftone'};
  for (const [button, role, uuid] of [[3, 'primary', TIMER], [1, 'secondary', MUSIC]]) {
    const options = {encodedSettings: JSON.stringify(chosen)};
    const app = rig(options); app.hello(button);
    assert.equal(app.subscription.plugin, navigation.halftoneUuid);
    // Saving another choice cannot retarget an attempt already in progress.
    options.encodedSettings = JSON.stringify(settings.defaults());
    app.data(source({}, navigation.halftoneUuid));
    assert.equal(protocol.get(app.prepare(), 'OA_ROLE'), protocol.role[role]);
    app.confirm(); app.confirm();
    assert.equal(app.invocations.length, 1); assert.equal(app.invocations[0].args.uuid, uuid);
  }
  for (const envelope of [source(), source({watchfaceUuid: navigation.dynamicUuid}, navigation.halftoneUuid),
    source({secondary: null}, navigation.halftoneUuid), source({expiresAtMs: NOW}, navigation.halftoneUuid)]) {
    const app = rig({encodedSettings: JSON.stringify(chosen)}); app.hello(1); app.data(envelope);
    assert.equal(app.launcher.state(), 'closed'); assert.equal(app.prepare(), undefined);
    assert.equal(app.invocations.length, 0); assert.equal(app.unsubscribed, 1);
  }
  const dynamic = rig(); dynamic.hello(); dynamic.data(source({}, navigation.halftoneUuid));
  assert.equal(dynamic.launcher.state(), 'closed'); assert.equal(dynamic.invocations.length, 0);
  for (const watchface of ['auto', 'Halftone', null, {}, 1]) {
    const app = rig({encodedSettings: JSON.stringify({...chosen, watchface})}); app.hello();
    assert.equal(app.subscription, undefined); assert.equal(app.launcher.state(), 'closed');
  }
});
test('saved independent mappings select a different role', () => {
  const value = {version: 1, defaultRole: 'secondary', holdOverrides: {up: 'primary', down: 'secondary'}};
  const app = rig({encodedSettings: JSON.stringify(value)}); app.hello(3); app.data();
  assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), MUSIC);
});
test('all Quick Launch slots can independently open either role, including tap versus hold', () => {
  for (const [button, gesture, key] of [[0, 1, 'back'], [1, 1, 'up'], [2, 1, 'select'],
    [3, 1, 'down'], [1, 2, 'up'], [3, 2, 'down'], [0, 3, 'backUp'], [1, 3, 'upDown']]) {
    for (const role of ['primary', 'secondary']) {
      const chosen = {version: 1, defaultRole: role === 'primary' ? 'secondary' : 'primary', holdOverrides: {}};
      if (gesture === 1) chosen.holdOverrides[key] = role;
      else if (gesture === 2) chosen.tapOverrides = {[key]: role};
      else chosen.comboOverrides = {[key]: role};
      const app = rig({encodedSettings: JSON.stringify(chosen)});
      app.hello(button, 10, gesture); app.data();
      assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), role === 'primary' ? TIMER : MUSIC);
      assert.equal(app.invocations.length, 0);
      app.confirm(); app.confirm();
      assert.equal(app.invocations.length, 1);
      assert.equal(app.invocations[0].args.uuid, role === 'primary' ? TIMER : MUSIC);
    }
  }
  const chosen = {version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary'}, tapOverrides: {up: 'primary'}};
  const tap = rig({encodedSettings: JSON.stringify(chosen)}); tap.hello(1, 10, 2); tap.data();
  const hold = rig({encodedSettings: JSON.stringify(chosen)}); hold.hello(1, 10, 1); hold.data();
  assert.equal(protocol.get(tap.prepare(), 'OA_DESTINATION'), TIMER);
  assert.equal(protocol.get(hold.prepare(), 'OA_DESTINATION'), MUSIC);
});
test('each role can choose any one shortcut while other shortcuts close without a launch', () => {
  const slots = [[0,1,'hold-back'],[1,1,'hold-up'],[2,1,'hold-select'],[3,1,'hold-down'],
    [1,2,'tap-up'],[3,2,'tap-down'],[0,3,'combo-back-up'],[1,3,'combo-up-down']];
  for (const [button, gesture, shortcut] of slots) for (const role of ['primary', 'secondary']) {
    const chosen = {version: 2, primaryShortcut: 'none', secondaryShortcut: 'none'};
    chosen[role + 'Shortcut'] = shortcut;
    const app = rig({encodedSettings: JSON.stringify(chosen)});
    app.hello(button, 10, gesture); app.data();
    assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), role === 'primary' ? TIMER : MUSIC);
    assert.equal(app.invocations.length, 0);
    app.confirm(); app.confirm();
    assert.equal(app.invocations.length, 1);
    assert.equal(app.invocations[0].args.uuid, role === 'primary' ? TIMER : MUSIC);
    for (const [otherButton, otherGesture, otherShortcut] of slots) {
      if (otherShortcut === shortcut) continue;
      const unassigned = rig({encodedSettings: JSON.stringify(chosen)});
      unassigned.hello(otherButton, 10, otherGesture);
      assert.equal(unassigned.subscription, undefined);
      assert.equal(unassigned.launcher.state(), 'closed');
      assert.equal(unassigned.invocations.length, 0);
    }
  }
  const disabled = rig({encodedSettings: JSON.stringify({version: 2, primaryShortcut: 'none', secondaryShortcut: 'none'})});
  disabled.hello(3);
  assert.equal(disabled.subscription, undefined);
  assert.equal(disabled.launcher.state(), 'closed');
  const collision = rig({encodedSettings: JSON.stringify({version: 2, primaryShortcut: 'tap-up', secondaryShortcut: 'tap-up'})});
  collision.hello(1, 10, 2);
  assert.equal(collision.subscription, undefined);
  assert.equal(collision.launcher.state(), 'closed');
});
test('unsupported or missing gesture never resolves a destination', () => {
  for (const [button, gesture] of [[1, 0], [1, 4], [1, -1], [1, '1'], [1, null], [0, 2], [2, 2], [2, 3], [3, 3]]) {
    const app = rig(); app.hello(button, 10, gesture);
    assert.equal(app.subscription, undefined);
    assert.equal(app.launcher.state(), 'closed');
  }
  const missing = rig(); missing.launcher.ready();
  missing.launcher.message(protocol.message(op.HELLO, {OA_SESSION: 42, OA_BUTTON: 1, OA_ELAPSED_MS: 10}));
  assert.equal(missing.subscription, undefined);
  assert.equal(missing.launcher.state(), 'closed');
});
test('wrong confirmation session, ticket, destination and role are ignored', () => {
  const app = rig(); app.hello(); app.data();
  for (const change of [
    {[protocol.keys.OA_SESSION]: 43}, {[protocol.keys.OA_TICKET]: 778},
    {[protocol.keys.OA_DESTINATION]: MUSIC}, {[protocol.keys.OA_ROLE]: 2}
  ]) app.confirm(change);
  assert.equal(app.invocations.length, 0);
  app.confirm(); assert.equal(app.invocations.length, 1);
});
test('Back before source reply prevents any later preparation or invocation', () => {
  const app = rig(); app.hello();
  app.launcher.message(protocol.message(op.CANCEL, {OA_SESSION: 42}));
  app.data(); app.launcher.ready();
  assert.equal(app.launcher.state(), 'closed');
  assert.equal(app.prepare(), undefined);
  assert.equal(app.invocations.length, 0);
});
test('Back during prepare ignores a late matching confirmation', () => {
  const app = rig(); app.hello(); app.data();
  app.launcher.message(protocol.message(op.CANCEL, {OA_SESSION: 42}));
  app.confirm();
  assert.equal(app.invocations.length, 0);
});
test('native elapsed time reduces phone budget; timeout never replays', () => {
  const app = rig(); app.hello(3, 3990);
  app.advance(10);
  assert.equal(app.launcher.state(), 'closed');
  app.data(); app.launcher.ready();
  app.launcher.message(protocol.message(op.HELLO, {OA_SESSION: 99, OA_BUTTON: 3, OA_GESTURE: protocol.gesture.hold, OA_ELAPSED_MS: 0}));
  assert.equal(app.invocations.length, 0);
});
test('candidate can expire between source result and final confirmation', () => {
  const app = rig(); app.hello(); app.data(source({expiresAtMs: NOW + 50}));
  app.advance(50); app.confirm();
  assert.equal(app.invocations.length, 0);
  assert.equal(app.launcher.state(), 'closed');
});
test('a late/invalid native elapsed confirmation never dispatches', () => {
  for (const elapsed of [4000, -1, 1.5, '100']) {
    const app = rig(); app.hello(); app.data();
    app.confirm({[protocol.keys.OA_ELAPSED_MS]: elapsed});
    assert.equal(app.invocations.length, 0);
    assert.equal(app.launcher.state(), 'closed');
  }
});
test('wrong provider, invalid source or SDK failure closes', () => {
  const wrong = source(); wrong.pluginUuid = TIMER;
  const app = rig(); app.hello(); app.data(wrong);
  assert.equal(app.launcher.state(), 'closed');
  const failed = rig(); failed.hello(); failed.error();
  assert.equal(failed.launcher.state(), 'closed');
  const unavailable = rig({noSdk: true}); unavailable.hello();
  assert.equal(unavailable.launcher.state(), 'closed');
  const throwing = rig({sourceThrows: true}); throwing.hello();
  assert.equal(throwing.launcher.state(), 'closed');
});
test('synchronous source callback releases subscription and unsubscribes only once', () => {
  const app = rig({synchronousData: source()}); app.hello();
  assert.equal(app.launcher.state(), 'preparing');
  assert.equal(app.unsubscribed, 1);
  app.data(); assert.equal(app.messages.filter(x => protocol.get(x, 'OA_OPERATION') === op.PREPARE).length, 1);
});
test('duplicates and late provider updates cannot retarget a resolved attempt', () => {
  const app = rig(); app.hello(); app.data();
  app.data(source({primary: {watchAppUuid: MUSIC}}));
  app.confirm();
  assert.equal(app.invocations.length, 1);
  assert.equal(app.invocations[0].args.uuid, TIMER);
});
test('invocation failure closes, success never issues return navigation', async () => {
  for (const result of [{ok: false, code: 'PERMISSION_DENIED'}, undefined, null]) {
    const app = rig({result}); app.hello(); app.data(); app.confirm();
    if (result !== undefined) {
      await Promise.resolve(); await Promise.resolve();
      assert.equal(app.launcher.state(), 'closed');
    }
    assert.equal(app.invocations.length, 1);
  }
  const success = rig({result: {ok: true}}); success.hello(); success.data(); success.confirm();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(success.launcher.state(), 'dispatched');
  assert.equal(success.invocations.length, 1);
  assert.equal(success.invocations[0].action, 'launch_app');
});
test('post-dispatch timeout/Back closes locally without pretending to recall operation', () => {
  const app = rig(); app.hello(); app.data(); app.confirm();
  app.advance(4000); app.confirm(); app.launcher.ready();
  assert.equal(app.launcher.state(), 'closed');
  assert.equal(app.invocations.length, 1);
});
test('bad settings and malformed native hello never subscribe or launch', () => {
  const app = rig({encodedSettings: '{broken'}); app.hello();
  assert.equal(app.subscription, undefined);
  assert.equal(app.launcher.state(), 'closed');
  for (const button of ['toString', 4, -1, null]) {
    const malformed = rig(); malformed.hello(button);
    assert.equal(malformed.subscription, undefined);
    assert.equal(malformed.invocations.length, 0);
  }
});
test('closing discards queued preparation before old transport callback fires', () => {
  const app = rig({delayTransport: true}); app.hello(); app.data();
  assert.equal(app.prepare(), undefined);
  app.launcher.cancel();
  app.queued[0].success();
  assert.equal(app.prepare(), undefined);
  assert.equal(app.invocations.length, 0);
});
test('symbolic protocol keys are accepted alongside numeric SDK keys', () => {
  const app = rig(); app.launcher.ready();
  app.launcher.message({OA_OPERATION: op.HELLO, OA_SESSION: 42, OA_BUTTON: 1, OA_GESTURE: protocol.gesture.hold, OA_ELAPSED_MS: 0});
  app.data();
  assert.equal(protocol.get(app.prepare(), 'OA_DESTINATION'), MUSIC);
});
