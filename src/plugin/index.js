'use strict';

var settings = require('../pkjs/settings');
var uiSettings = require('../pkjs/ui-settings');

// A config-only plugin allows phone settings while the transition watchapp is
// closed. It ships inside the same PBW/UUID and exposes no sources or actions.
Pebble.registerConfigHandler(function (message, respond) {
  try {
    if (!message || message.type === 'getSettings' || message.type === 'load_settings') {
      var current = settings.load(localStorage);
      var loaded = {ok: true, settings: settings.choices(current || settings.defaults()), needsRepair: !current,
        needsMigration: !!current && current.version === 1};
      if (message && message.uiVersion === 1) {
        var appearance = uiSettings.load(localStorage); loaded.appearance = appearance || uiSettings.defaults();
        loaded.needsAppearanceRepair = !appearance;
      }
      respond(loaded);
    } else if (message.type === 'saveSettings' || message.type === 'save_settings') {
      var normalized = settings.normalize(message.settings);
      var selected = normalized && settings.choices(normalized);
      var appearance = message.uiVersion === 1 ? uiSettings.normalize(message.appearance) : undefined;
      if (!selected || message.uiVersion === 1 && !appearance) {respond(message.uiVersion === 1 ? {ok: false, rejected: true} : {ok: false}); return;}
      if (!settings.save(localStorage, selected) || appearance && !uiSettings.save(localStorage, appearance)) {respond({ok: false}); return;}
      var receipt = {ok: true, settings: selected};
      if (appearance) { receipt.appearance = appearance; receipt.watchDelivery = 'deferred'; }
      respond(receipt);
    } else respond({ok: false});
  } catch (error) { respond({ok: false}); }
});
