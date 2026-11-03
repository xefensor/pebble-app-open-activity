'use strict';

var protocol = require('./protocol');
var navigation = require('./navigation');
var settings = require('./settings');
var createQueue = require('./queue');
var operation = protocol.operation;
var WATCH_STATE = '00000000-0000-0000-0001-000000000007';
function uint32(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value > 0 && value <= 4294967295;
}

module.exports = function (options) {
  var pebble = options.pebble;
  var now = options.now || function () { return Date.now(); };
  var later = options.later || function (fn, delay) { return setTimeout(fn, delay); };
  var cancelLater = options.cancelLater || function (id) { clearTimeout(id); };
  // Keep generated wire values positive even on signed-int AppMessage bridges.
  var ticket = options.ticket || function () { return Math.floor(Math.random() * 2147483647) + 1; };
  var queue = createQueue(function (message, success, failure) { pebble.sendAppMessage(message, success, failure); });
  var phase = 'idle', attempt = null, ready = false;

  function stopSource(current) {
    if (!current) return;
    current.sourceDone = true;
    if (current.source && typeof current.source.unsubscribe === 'function') {
      try { current.source.unsubscribe(); } catch (error) {}
    }
    current.source = null;
  }
  function close(notify) {
    if (phase === 'closed') return;
    phase = 'closed'; queue.clear();
    stopSource(attempt);
    if (attempt && attempt.timer !== null) cancelLater(attempt.timer);
    if (notify && attempt) queue.send(protocol.message(operation.CLOSE, {OA_SESSION: attempt.session}));
  }
  function current(value) { return attempt === value && phase !== 'closed' && now() < value.deadline; }
  function sourceData(value, envelope) {
    if (!current(value) || phase !== 'resolving') return;
    var destination = navigation.resolve(envelope, value.role, now());
    stopSource(value);
    if (!destination) { close(true); return; }
    value.destination = destination;
    phase = 'preparing';
    queue.send(protocol.message(operation.PREPARE, {
      OA_SESSION: value.session, OA_TICKET: value.ticket,
      OA_ROLE: protocol.role[value.role], OA_DESTINATION: destination.watchAppUuid
    }), null, function () { if (current(value)) close(true); });
  }
  function start(message) {
    if (phase !== 'idle') return;
    var session = protocol.get(message, 'OA_SESSION');
    var elapsed = protocol.get(message, 'OA_ELAPSED_MS');
    var button = protocol.get(message, 'OA_BUTTON');
    var saved = settings.load(options.storage);
    var role = settings.select(saved, button);
    if (!uint32(session) || typeof elapsed !== 'number' || Math.floor(elapsed) !== elapsed ||
        elapsed < 0 || elapsed >= protocol.budgetMs || !role) {
      // A malformed hello never acquires a source or launches an app.
      attempt = uint32(session) ? {session: session, timer: null} : null;
      close(true); return;
    }
    var requestTicket = ticket();
    if (!uint32(requestTicket)) { attempt = {session: session, timer: null}; close(true); return; }
    attempt = {
      session: session, ticket: requestTicket, role: role,
      deadline: now() + protocol.budgetMs - elapsed,
      destination: null, source: null, sourceDone: false, timer: null
    };
    var value = attempt;
    phase = 'resolving';
    value.timer = later(function () { if (attempt === value) close(true); }, protocol.budgetMs - elapsed);
    if (typeof pebble.subscribeToSource !== 'function' || typeof pebble.invokeAction !== 'function') {
      close(true); return;
    }
    try {
      var source = pebble.subscribeToSource({
        plugin: navigation.dynamicUuid,
        category: 'navigation', item: 'presented_activities', properties: ['hint'],
        onData: function (envelope) { sourceData(value, envelope); },
        onError: function () { if (current(value) && phase === 'resolving') close(true); }
      });
      if (value.sourceDone || phase === 'closed') {
        if (source && typeof source.unsubscribe === 'function') source.unsubscribe();
      } else value.source = source;
    } catch (error) { close(true); }
  }
  function confirm(message) {
    var value = attempt;
    if (!value || phase !== 'preparing' || !current(value)) return;
    var elapsed = protocol.get(message, 'OA_ELAPSED_MS');
    if (protocol.get(message, 'OA_SESSION') !== value.session ||
        protocol.get(message, 'OA_TICKET') !== value.ticket ||
        protocol.get(message, 'OA_ROLE') !== protocol.role[value.role] ||
        protocol.get(message, 'OA_DESTINATION') !== value.destination.watchAppUuid) return;
    if (typeof elapsed !== 'number' || Math.floor(elapsed) !== elapsed || elapsed < 0 ||
        elapsed >= protocol.budgetMs || now() >= value.destination.expiresAtMs) { close(true); return; }
    // State changes before invocation: duplicate confirmations can never dispatch twice.
    phase = 'dispatched';
    var pending;
    try {
      pending = pebble.invokeAction({
        plugin: WATCH_STATE, action: 'launch_app', args: {uuid: value.destination.watchAppUuid},
        timeoutMs: Math.max(1, Math.min(value.deadline - now(), protocol.budgetMs - elapsed))
      });
    } catch (error) { close(true); return; }
    Promise.resolve(pending).then(function (result) {
      if (attempt !== value || phase === 'closed') return;
      if (!result || result.ok !== true) close(true);
      // On success, the target replaces this native app. Never return to the face here.
    }, function () { if (attempt === value && phase !== 'closed') close(true); });
  }
  return {
    ready: function () {
      if (ready || phase === 'closed') return;
      ready = true;
      queue.send(protocol.message(operation.REQUEST), null, function () { close(false); });
    },
    message: function (message) {
      var kind = protocol.get(message, 'OA_OPERATION');
      if (kind === operation.HELLO) start(message);
      else if (kind === operation.CONFIRM) confirm(message);
      else if (kind === operation.CANCEL && attempt && protocol.get(message, 'OA_SESSION') === attempt.session) close(false);
    },
    cancel: function () { close(true); },
    state: function () { return phase; }
  };
};
