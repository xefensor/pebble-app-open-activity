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
