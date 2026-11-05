'use strict';

var settings = require('../pkjs/settings');

// A config-only plugin allows phone settings while the transition watchapp is
// closed. It ships inside the same PBW/UUID and exposes no sources or actions.
Pebble.registerConfigHandler(function (message, respond) {
  try {
    if (!message || message.type === 'getSettings' || message.type === 'load_settings') {
      var current = settings.load(localStorage);
      respond({ok: true, settings: settings.choices(current || settings.defaults()), needsRepair: !current,
        needsMigration: !!current && current.version === 1});
    } else if (message.type === 'saveSettings' || message.type === 'save_settings') {
      var normalized = settings.normalize(message.settings);
      var selected = normalized && settings.choices(normalized);
      if (!selected || !settings.save(localStorage, selected)) {respond({ok: false}); return;}
      respond({ok: true, settings: selected});
    } else respond({ok: false});
  } catch (error) { respond({ok: false}); }
});
