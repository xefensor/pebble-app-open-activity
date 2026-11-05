'use strict';

var createLauncher = require('./launcher');
var settings = require('./settings');
var launcher = createLauncher({pebble: Pebble, storage: localStorage});

Pebble.addEventListener('ready', function () { launcher.ready(); });
Pebble.addEventListener('appmessage', function (event) { launcher.message(event && event.payload); });
Pebble.addEventListener('showConfiguration', function () {
  // Quick Launch does not need to initialize the legacy configuration page.
  var page = require('./settings-page');
  var current = settings.load(localStorage);
  Pebble.openURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(current || settings.defaults(), !current)));
});
Pebble.addEventListener('webviewclosed', function (event) {
  if (!event || !event.response) return;
  try {
    var text = event.response;
    var response = JSON.parse(text.charAt(0) === '{' ? text : decodeURIComponent(text));
    settings.save(localStorage, response);
  } catch (error) {}
});
Pebble.addEventListener('configmessage', function (event) {
  if (!event || typeof event.respond !== 'function') return;
  var message = event.message || event.data || event.payload || event;
  try {
    if (typeof message === 'string') message = JSON.parse(message);
    if (!message || message.type === 'getSettings' || message.type === 'load_settings') {
      var current = settings.load(localStorage);
      event.respond({ok: true, settings: settings.choices(current || settings.defaults()),
        needsRepair: !current, needsMigration: !!current && current.version === 1});
    } else if (message.type === 'saveSettings' || message.type === 'save_settings') {
      var normalized = settings.normalize(message.settings);
      var selected = normalized && settings.choices(normalized);
      // Save through the active PKJS DOM and its native write-through store.
      // Plugin-only writes can be replaced by Android's stale DOM at teardown.
      if (!selected || !settings.save(localStorage, selected)) {event.respond({ok: false}); return;}
      event.respond({ok: true, settings: selected});
    } else event.respond({ok: false});
  } catch (error) { event.respond({ok: false}); }
});
