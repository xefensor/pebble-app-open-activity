'use strict';

var createLauncher = require('./launcher');
var settings = require('./settings');
var uiSettings = require('./ui-settings');
var launcher = createLauncher({pebble: Pebble, storage: localStorage});

Pebble.addEventListener('ready', function () { launcher.ready(); });
Pebble.addEventListener('appmessage', function (event) { launcher.message(event && event.payload); });
Pebble.addEventListener('showConfiguration', function () {
  // Quick Launch does not need to initialize the legacy configuration page.
  var page = require('./settings-page');
  var current = settings.load(localStorage);
  Pebble.openURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(current || settings.defaults(), !current, uiSettings.load(localStorage))));
});
Pebble.addEventListener('webviewclosed', function (event) {
  if (!event || !event.response) return;
  try {
    var text = event.response;
    var response = JSON.parse(text.charAt(0) === '{' ? text : decodeURIComponent(text));
    if (response && response.uiVersion === 1) {
      var appearance = uiSettings.normalize(response.appearance);
      var selected = settings.normalize(response.settings);
      if (appearance && selected && settings.save(localStorage, selected) && uiSettings.save(localStorage, appearance)) launcher.appearanceChanged();
    } else settings.save(localStorage, response);
  } catch (error) {}
});
Pebble.addEventListener('configmessage', function (event) {
  if (!event || typeof event.respond !== 'function') return;
  var message = event.message || event.data || event.payload || event;
  try {
    if (typeof message === 'string') message = JSON.parse(message);
    if (!message || message.type === 'getSettings' || message.type === 'load_settings') {
      var current = settings.load(localStorage);
      var loaded = {ok: true, settings: settings.choices(current || settings.defaults()),
        needsRepair: !current, needsMigration: !!current && current.version === 1};
      if (message && message.uiVersion === 1) {
        var appearance = uiSettings.load(localStorage); loaded.appearance = appearance || uiSettings.defaults();
        loaded.needsAppearanceRepair = !appearance;
      }
      event.respond(loaded);
    } else if (message.type === 'saveSettings' || message.type === 'save_settings') {
      var normalized = settings.normalize(message.settings);
      var selected = normalized && settings.choices(normalized);
      // Save through the active PKJS DOM and its native write-through store.
      // Plugin-only writes can be replaced by Android's stale DOM at teardown.
      var appearance = message.uiVersion === 1 ? uiSettings.normalize(message.appearance) : undefined;
      if (!selected || message.uiVersion === 1 && !appearance) {event.respond(message.uiVersion === 1 ? {ok: false, rejected: true} : {ok: false}); return;}
      if (!settings.save(localStorage, selected) || appearance && !uiSettings.save(localStorage, appearance)) {event.respond({ok: false}); return;}
      var receipt = {ok: true, settings: selected};
      if (appearance) {
        receipt.appearance = appearance;
        receipt.watchDelivery = launcher.appearanceChanged() ? 'queued' : 'deferred';
      }
      event.respond(receipt);
    } else event.respond({ok: false});
  } catch (error) { event.respond({ok: false}); }
});
