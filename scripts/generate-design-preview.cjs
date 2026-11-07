'use strict';
// Review-only copy. The production config.html never receives this mock bridge.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
function bridge() {
  var settings = {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'hold-up'};
  var appearance = {version: 1, theme: 'light'};
  window.Pebble = {
    targets: function() { return Promise.resolve([{id: 'plugin'}]); },
    addEventListener: function(name, fn) {
      if (name === 'ready') document.addEventListener('DOMContentLoaded', function() { fn({target: 'plugin'}); });
    },
    sendMessage: function(target, message) {
      if (message.type === 'saveSettings') {
        settings = JSON.parse(JSON.stringify(message.settings));
        appearance = JSON.parse(JSON.stringify(message.appearance || appearance));
      }
      return Promise.resolve({ok: true, settings: settings, appearance: appearance, watchDelivery: 'deferred'});
    }
  };
}
const shim = '<script>(' + bridge.toString() + ')();</script>';
const note = '<aside style="padding:10px 16px;font:14px/1.5 system-ui,sans-serif;background:#e6eff9;color:#163b60;border-bottom:1px solid #b6cbe3">Layout preview with sample values. Save changes this page’s memory only; no phone or watch is connected.</aside>';
const html = fs.readFileSync(path.join(root, 'config.html'), 'utf8')
  .replace('<script>', shim + '<script>').replace('<body>', '<body>' + note);
const output = path.join(process.env.PEBBLE_QA_OUTPUT_ROOT || path.join(root, 'build/qa'), 'phone-preview.html');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, html);
console.log(output);
