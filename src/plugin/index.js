'use strict';

var settings = require('../pkjs/settings');

// A config-only plugin allows phone settings while the transition watchapp is
// closed. It ships inside the same PBW/UUID and exposes no sources or actions.
Pebble.registerConfigHandler(function (message, respond) {
  if (!message || message.type === 'getSettings') {
    var current = settings.load(localStorage);
    respond({ok: true, settings: settings.choices(current || settings.defaults()), needsRepair: !current,
      needsMigration: !!current && current.version === 1});
  } else if (message.type === 'saveSettings') {
    var accepted = settings.save(localStorage, message.settings);
    respond({ok: accepted});
  } else respond({ok: false});
});
