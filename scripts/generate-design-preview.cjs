'use strict';
// Review-only copy. The production config.html never receives this mock bridge.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function bridge() {
  var copy = function(value) { return JSON.parse(JSON.stringify(value)); };
  var params = new URLSearchParams(location.search);
  var locale = params.get('lang');
  if (locale) Object.defineProperty(navigator, 'language', {configurable: true, get: function() { return locale; }});
  var scenario = params.get('scenario') || params.get('preview') || 'pending';
  var settings = {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'hold-up'};
  var preferences = {version: 2, textSize: 'follow', appearance: 'light', lastExplicit: 'light'};
  if (scenario === 'legacy-follow') { preferences.appearance = 'follow'; preferences.lastExplicit = 'dark'; }
  var appearance = {version: 1, theme: preferences.lastExplicit};
  var delivery = {applied: false, pending: true, error: null};
  var failLoad = scenario === 'load-fail' || scenario === 'load-error';
  var slowLoad = scenario === 'loading';
  var nextSave = scenario === 'save-fail' || scenario === 'save-error' ? 'fail' : scenario === 'save-rejected' ? 'reject' : scenario === 'save-unconfirmed' ? 'lost' : 'confirm';
  var scenarioControl = document.getElementById('preview-scenario');
  var saveControl = document.getElementById('preview-save');
  var receiptControl = document.getElementById('preview-receipt');
  var previewStatus = document.getElementById('preview-status');
  scenarioControl.value = scenario;
  saveControl.value = nextSave;
  function preferenceReply() { return {ok: true, settings: copy(preferences), saved: true, delivery: copy(delivery)}; }
  function receipt() {
    return {ok: true, settings: copy(settings), needsRepair: false, needsMigration: false,
      appearance: copy(appearance), preferences: preferenceReply(), watchDelivery: 'deferred'};
  }
  function setDelivery(value) {
    delivery = {applied: value === 'applied', pending: value !== 'applied', error: value === 'error' ? 'watch_save_unconfirmed' : null};
    receiptControl.value = value;
  }
  document.getElementById('preview-reload').onclick = function() {
    var url = new URL(location.href); url.searchParams.set('scenario', scenarioControl.value); location.href = url.href;
  };
  saveControl.onchange = function() { nextSave = saveControl.value; };
  receiptControl.onchange = function() {
    setDelivery(receiptControl.value);
    previewStatus.textContent = 'Mock receipt changed. The page reads it on its next status check (within five seconds when saved).';
  };
  document.getElementById('preview-draft').onclick = function() {
    var field = document.getElementById('watchface');
    if (field.disabled) { previewStatus.textContent = 'Wait for loading or saving to finish before editing the sample.'; return; }
    field.value = field.value === 'dynamic' ? 'halftone' : 'dynamic';
    field.dispatchEvent(new Event('change', {bubbles: true}));
    previewStatus.textContent = 'Changed the real Watchface field. Save and Discard use the page’s normal draft flow.';
  };
  window.Pebble = {
    targets: function() { return Promise.resolve([{id: 'plugin'}]); },
    addEventListener: function(name, fn) {
      if (name === 'ready') document.addEventListener('DOMContentLoaded', function() { fn({target: 'plugin'}); });
    },
    sendMessage: function(target, message) {
      return new Promise(function(resolve, reject) {
        var delay = message.type === 'getSettings' && slowLoad ? 4000 : 300;
        slowLoad = false;
        setTimeout(function() {
          if (target !== 'plugin') { reject(Error('The preview has no live phone runtime.')); return; }
          if (message.type === 'getSettings') {
            if (failLoad) { failLoad = false; reject(Error('Simulated loading failure')); return; }
            resolve(receipt()); return;
          }
          if (message.type === 'getUiPreferences') { resolve(preferenceReply()); return; }
          if (message.type === 'retryUiPreferences') { setDelivery('pending'); resolve(preferenceReply()); return; }
          if (message.type === 'saveSettings') {
            var result = nextSave; nextSave = 'confirm'; saveControl.value = nextSave;
            if (result === 'reject') { resolve({ok: false, rejected: true}); return; }
            if (result === 'fail') { reject(Error('Simulated transport failure before writing')); return; }
            settings = copy(message.settings);
            if (message.appearance) appearance = copy(message.appearance);
            if (message.preferences) preferences = copy(message.preferences);
            setDelivery('pending');
            if (result === 'lost') { reject(Error('Simulated lost acknowledgement after saving')); return; }
            resolve(receipt()); return;
          }
          resolve({ok: false});
        }, delay);
      });
    }
  };
}
const shim = '<script>(' + bridge.toString() + ')();</script>';
const note = `<aside aria-label="Preview controls" style="padding:12px 16px;font:14px/1.5 system-ui,sans-serif;background:#e6eff9;color:#163b60;border-bottom:1px solid #b6cbe3">
  <p style="margin:0 0 8px"><strong>Interactive layout preview.</strong> Sample values and simulated responses only. Save changes this page’s memory; no phone or watch is connected. Reloading resets the sample.</p>
  <details><summary style="cursor:pointer">Preview controls</summary>
    <div style="display:grid;gap:8px;max-width:480px;margin:8px auto">
      <label style="margin:0">Sample state<select id="preview-scenario"><option value="pending">Saved on phone; pending on watch</option><option value="loading">Loading for four seconds</option><option value="load-fail">Loading fails once; Retry succeeds</option><option value="save-fail">Next Save fails before writing</option><option value="save-rejected">Next Save is explicitly rejected</option><option value="save-unconfirmed">Next Save is written; confirmation is lost</option><option value="legacy-follow">Existing Follow appearance with Dark fallback</option></select></label>
      <button id="preview-reload" type="button">Reload sample</button>
      <button id="preview-draft" type="button">Make a draft change</button>
      <label style="margin:0">Next Save response<select id="preview-save"><option value="confirm">Confirm normally</option><option value="fail">Fail before writing</option><option value="reject">Reject before writing</option><option value="lost">Write; lose confirmation</option></select></label>
      <label style="margin:0">Mock watch receipt<select id="preview-receipt"><option value="pending">Pending on watch</option><option value="applied">Applied on watch</option><option value="error">Watch could not confirm saving</option></select></label>
      <p id="preview-status" role="status" style="margin:0">These controls affect only this preview. Edit the settings below to use the real draft, Save, Discard and Retry flow.</p>
    </div>
  </details>
</aside>`;
const html = fs.readFileSync(path.join(root, 'config.html'), 'utf8')
  .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`)
  .replace('<script>', shim + '<script>').replace('<body>', '<body>' + note);
const output = path.resolve(process.argv[2] || path.join(process.env.PEBBLE_QA_OUTPUT_ROOT || path.join(root, 'build/qa'), 'phone-preview.html'));
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, html);
console.log(output);
