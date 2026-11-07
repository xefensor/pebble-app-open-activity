'use strict';

var model = require('./settings');
var uiModel = require('./ui-settings');
var translations = require('./settings-i18n');

// Both settings paths use this layout. The build writes config.html from it.
function behavior(initial) {
  'use strict';
  var primary = document.getElementById('primary'), secondary = document.getElementById('secondary');
  var theme = document.getElementById('watch-theme'), delivery = document.getElementById('watch-delivery');
  var appearanceSupported = false, appearanceRepair = false, savedAppearance = '';
  var locale = typeof navigator !== 'undefined' && /^cs(?:[-_]|$)/i.test(navigator.language || '') ? 'cs' : 'en';
  var dictionary = initial.translations && initial.translations[locale] || {};
  function tr(text) { return dictionary[text] || text; }
  if (document.documentElement) document.documentElement.lang = locale;
  if (document.querySelectorAll) Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function(node) { node.textContent = tr(node.getAttribute('data-i18n')); });
  var fields = [primary, secondary], form = document.getElementById('settings');
  var save = document.getElementById('save'), discard = document.getElementById('discard');
  var retry = document.getElementById('retry'), status = document.getElementById('status');
  var actions = document.getElementById('actions'), conflict = document.getElementById('shortcut-error');
  var assignment = document.getElementById('assignment-help');
  var loaded = false, repairing = false, migrating = false, uncertain = false, saved = '', phase = 'loading';
  var operation = 0, timer = null, bridgeReady = false, pkjsReady = false;
  var layoutPending = false, lastFlow = null, lastHeight = null;
  var legacy = initial.mode === 'legacy';
  function shortcut(value) {
    return ['none','hold-up','hold-select','hold-down','hold-back','tap-up','tap-down','combo-back-up','combo-up-down'].indexOf(value) !== -1;
  }
  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 2 ||
        Object.keys(value).some(function(name) { return ['version','primaryShortcut','secondaryShortcut'].indexOf(name) === -1; }) ||
        !shortcut(value.primaryShortcut) || !shortcut(value.secondaryShortcut) ||
        value.primaryShortcut !== 'none' && value.primaryShortcut === value.secondaryShortcut) return null;
    return {version: 2, primaryShortcut: value.primaryShortcut, secondaryShortcut: value.secondaryShortcut};
  }
  function normalizeAppearance(value) {
    if (!value || value.version !== 1 || value.theme !== 'light' && value.theme !== 'dark' ||
        Object.keys(value).some(function(key) { return key !== 'version' && key !== 'theme'; })) return null;
    return {version: 1, theme: value.theme};
  }
  function appearanceValue() { return appearanceSupported ? normalizeAppearance({version: 1, theme: theme.value}) : undefined; }
  function value() {
    return normalize({version: 2, primaryShortcut: primary.value, secondaryShortcut: secondary.value});
  }
  function edited() { return loaded && (JSON.stringify(value()) !== saved || appearanceSupported && JSON.stringify(appearanceValue()) !== savedAppearance); }
  function dirty() { return loaded && (repairing || appearanceRepair || migrating || uncertain || edited()); }
  function message(text, error) {
    status.textContent = tr(text); status.className = error ? 'status error' : 'status';
    layoutActions();
  }
  function layoutActions() {
    if (typeof window === 'undefined' || typeof actions.getBoundingClientRect !== 'function') return;
    if (layoutPending) return;
    layoutPending = true;
    // Status, viewport and ResizeObserver notifications may describe the same
    // frame. Read geometry once after those changes and avoid unchanged writes.
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(measureActions);
    else setTimeout(measureActions, 0);
  }
  function measureActions() {
    layoutPending = false;
    var viewport = window.visualViewport && window.visualViewport.height || window.innerHeight;
    var height = actions.getBoundingClientRect().height;
    // A short viewport or large text needs a normal-flow action area. Keeping
    // it fixed would cover the focused picker or the last help paragraph.
    var inFlow = viewport < 560 || height > viewport * 0.28;
    var flow = inFlow ? 'true' : 'false', reserved = (inFlow ? 0 : height) + 'px';
    if (flow !== lastFlow) { actions.setAttribute('data-flow', flow); lastFlow = flow; }
    if (reserved !== lastHeight) {
      document.documentElement.style.setProperty('--actions-height', reserved); lastHeight = reserved;
    }
  }
  function selectedLabel(field) {
    for (var i = 0; i < field.options.length; i++)
      if (field.options[i].value === field.value) return tr(field.options[i].textContent);
    return '';
  }
  function describe() {
    var duplicate = loaded && primary.value !== 'none' && primary.value === secondary.value;
    conflict.hidden = !duplicate;
    conflict.textContent = duplicate ? tr('Choose a different shortcut for each activity.') : '';
    fields.forEach(function(field) {
      document.getElementById(field.id + '-help').textContent = tr(!loaded ? 'Saved choice not loaded yet.' : field.value === 'none' ?
        'No shortcut assigned.' : field.id === 'secondary' ? 'Opens the smaller activity row.' : 'Opens the large activity.');
      field.options[0].textContent = tr(phase === 'load-error' ? 'Not loaded' : 'Loading saved choice…');
      field.setAttribute('aria-invalid', duplicate ? 'true' : 'false');
    });
    var chosen = fields.filter(function(field) { return field.value && field.value !== 'none'; });
    assignment.hidden = !!duplicate;
    assignment.textContent = tr(!loaded ? 'Choose shortcuts, then assign Open Activity to them in Pebble’s Quick Launch settings.' :
      duplicate ? 'Use a different shortcut for each activity before setting up Quick Launch.' :
      !chosen.length ? 'No activity shortcut is enabled. Choose a shortcut above to open an activity.' :
      'In Pebble’s Quick Launch settings, assign Open Activity to {shortcuts}.').replace('{shortcuts}', chosen.map(selectedLabel).join(tr(' and ')));
    document.getElementById('watch-theme-help').textContent = tr(appearanceSupported ? 'Watch colours are independent of this phone page.' : 'Update Open Activity to change watch appearance.');
  }
  function controls() {
    var editing = loaded && phase !== 'saving';
    fields.forEach(function(field) { field.disabled = !editing; });
    theme.disabled = !editing || !appearanceSupported;
    save.disabled = !editing || !dirty() || !value() || appearanceSupported && !appearanceValue();
    save.textContent = tr(phase === 'saving' ? 'Saving…' : 'Save');
    discard.hidden = !legacy && !loaded;
    discard.disabled = phase === 'saving' || !legacy && !uncertain && !edited();
    discard.textContent = tr(legacy ? 'Cancel' : uncertain ? 'Reload saved' : 'Discard');
    retry.hidden = phase !== 'load-error'; describe();
  }
  function changed() {
    controls();
    message(!value() ? 'Choose a different shortcut for each activity.' : uncertain ? 'Save not confirmed. Reload saved choices or save again.' :
      edited() ? 'Unsaved changes.' : repairing || appearanceRepair ? 'Review these choices and save to repair unreadable settings.' :
      migrating ? 'Save to use these two shortcuts.' : 'No changes to save.', !value() || uncertain);
  }
  function apply(settings, repair, migration, appearance, repairAppearance) {
    primary.value = settings.primaryShortcut; secondary.value = settings.secondaryShortcut;
    var normalizedAppearance = normalizeAppearance(appearance);
    appearanceSupported = !!normalizedAppearance; appearanceRepair = repairAppearance === true;
    theme.value = normalizedAppearance ? normalizedAppearance.theme : '';
    savedAppearance = normalizedAppearance ? JSON.stringify(normalizedAppearance) : '';
    delivery.hidden = true;
    loaded = true; repairing = repair; migrating = migration; uncertain = false; saved = JSON.stringify(settings); phase = 'ready';
    controls();
    message(repair || appearanceRepair ? 'Saved settings could not be read. Review these choices before saving.' : migration ? 'Save to use these two shortcuts.' : 'No changes to save.', repair || appearanceRepair);
  }
  function stopTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
  function loadFailed() {
    loaded = false; phase = 'load-error'; controls();
    message('Could not load settings. Retry, or reopen this page from Pebble.', true);
  }
  function request(payload, complete, failed, target) {
    var current = ++operation; stopTimer();
    timer = setTimeout(function() { if (current === operation) { operation++; timer = null; failed(); } }, 6000);
    function finish(callback, response) {
      if (current !== operation) return;
      operation++; stopTimer(); callback(response);
    }
    try {
      var pending = Pebble.sendMessage(target || 'plugin', payload);
      if (!pending || typeof pending.then !== 'function') { finish(failed); return; }
      pending.then(function(response) { finish(complete, response); }, function() { finish(failed); });
    } catch (error) { finish(failed); }
  }
  function load() {
    var readback = uncertain;
    loaded = false; phase = 'loading';
    fields.forEach(function(field) { field.value = ''; }); theme.value = '';
    controls(); message('Loading settings…');
    if (!bridgeReady) { stopTimer(); timer = setTimeout(loadFailed, 6000); return; }
    request({type: 'getSettings', uiVersion: 1}, function(response) {
      var settings = response && response.ok === true && normalize(response.settings);
      if (!settings || response.appearance !== undefined && !normalizeAppearance(response.appearance)) { loadFailed(); return; }
      apply(settings, response.needsRepair === true, response.needsMigration === true, response.appearance, response.needsAppearanceRepair);
      if (readback && !repairing && !appearanceRepair) message('Saved settings reloaded.');
    }, loadFailed);
  }
  fields.forEach(function(field) { field.onchange = changed;
    for (var i = 0; i < field.options.length; i++) field.options[i].textContent = tr(field.options[i].textContent);
  });
  theme.onchange = changed;
  retry.onclick = load;
  discard.onclick = function() {
    if (legacy) location.href = 'pebblejs://close#';
    else if (loaded && uncertain) load();
    else if (loaded) apply(JSON.parse(saved), repairing, migrating, savedAppearance ? JSON.parse(savedAppearance) : undefined, appearanceRepair);
  };
  function saveFailed() {
    uncertain = true; phase = 'ready'; controls();
    message('Save not confirmed. Reload saved choices or save again.', true);
  }
  function settingsTarget(complete, failed) {
    if (typeof Pebble.targets !== 'function') { complete(pkjsReady ? 'pkjs' : 'plugin'); return; }
    var settled = false, lookupTimer = setTimeout(function() { finish(failed); }, 6000);
    function finish(callback, target) { if (settled) return; settled = true; clearTimeout(lookupTimer); callback(target); }
    try {
      Promise.resolve(Pebble.targets()).then(function(targets) {
        if (!Array.isArray(targets)) { finish(failed); return; }
        finish(complete, targets.some(function(target) { return target && target.id === 'pkjs'; }) ? 'pkjs' : 'plugin');
      }, function() { finish(failed); });
    } catch (error) { finish(failed); }
  }
  form.onsubmit = function(event) {
    if (event) event.preventDefault();
    if (save.disabled) return;
    var selected = value();
    if (!selected) { saveFailed(); return; }
    var selectedAppearance = appearanceValue();
    if (legacy) { location.href = 'pebblejs://close#' + encodeURIComponent(JSON.stringify(selectedAppearance ? {uiVersion: 1, settings: selected, appearance: selectedAppearance} : selected)); return; }
    phase = 'saving'; controls(); message('Saving…');
    var attempts = 0;
    function confirmed(settings, response) {
      apply(settings, false, false, selectedAppearance); message('✓ Saved');
      delivery.hidden = !selectedAppearance || response.watchDelivery !== 'deferred';
    }
    function write(target) {
      if (++attempts > 3) { saveFailed(); return; }
      var payload = {type: 'saveSettings', settings: selected};
      if (selectedAppearance) { payload.uiVersion = 1; payload.appearance = selectedAppearance; }
      request(payload, function(response) {
        if (response && response.ok === false && response.rejected === true) {
          uncertain = false; phase = 'ready'; controls(); message('Couldn’t save. Try again.', true); return;
        }
        var accepted = response && response.ok === true && normalize(response.settings);
        if (!accepted || JSON.stringify(accepted) !== JSON.stringify(selected) || selectedAppearance &&
            JSON.stringify(normalizeAppearance(response.appearance)) !== JSON.stringify(selectedAppearance)) { saveFailed(); return; }
        // Android PKJS owns a restored DOM snapshot. Keep it synchronized before
        // shutdown can persist that snapshot over the config plugin's store.
        if (target === 'plugin') settingsTarget(function(current) { if (current === 'pkjs') write(current); else confirmed(accepted, response); }, saveFailed);
        else confirmed(accepted, response);
      }, function() {
        if (target !== 'pkjs') { saveFailed(); return; }
        settingsTarget(function(current) { if (current === 'plugin') write(current); else saveFailed(); }, saveFailed);
      }, target);
    }
    settingsTarget(write, saveFailed);
  };
  save.onclick = function(event) { if (event) event.preventDefault(); form.onsubmit(); };
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', layoutActions);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layoutActions);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layoutActions).observe(actions);
  }
  if (legacy) apply(initial.settings, initial.needsRepair, initial.needsMigration, initial.appearance, initial.needsAppearanceRepair);
  else {
    if (typeof Pebble !== 'undefined' && typeof Pebble.addEventListener === 'function') {
      Pebble.addEventListener('ready', function(event) {
        if (event && event.target === 'pkjs') { pkjsReady = true; return; }
        if (event && event.target && event.target !== 'plugin') return;
        if (bridgeReady) return;
        bridgeReady = true; load();
      });
    }
    load();
  }
}
function render(initial) {
  initial.translations = translations;
  function picker(id, label) {
    var options = '<option value="none" data-i18n="Not assigned">Not assigned</option>' + model.shortcuts.map(function(shortcut) {
      return '<option value="' + shortcut.id + '">' + shortcut.label + '</option>';
    }).join('');
    return '<label data-i18n="' + label + '" for="' + id + '">' + label + '</label><select id="' + id + '" aria-describedby="' + id + '-help shortcut-error" disabled><option value="" disabled hidden selected data-i18n="Loading saved choice…">Loading saved choice…</option>' + options + '</select><p id="' + id + '-help" class="hint"></p>';
  }
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Activity</title><style>',
    ':root{color-scheme:light;--page:#f4f5f7;--card:#fff;--ink:#15181c;--muted:#5d6571;--line:#d9dee6;--accent:#6f42a9;--accent-ink:#fff;--field:#f4f5f7;--error:#a1231d}',
    '@media(prefers-color-scheme:dark){:root{color-scheme:dark;--page:#11151b;--card:#1d232d;--ink:#f3f5f7;--muted:#b5bfcc;--line:#465165;--accent:#c9a7ff;--accent-ink:#211332;--field:#252e3b;--error:#ffb4ab}}',
    '*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    'html{scroll-padding-bottom:calc(var(--actions-height,144px) + 16px)}main{max-width:512px;margin:auto;padding:24px 16px calc(var(--actions-height,144px) + 24px)}h1{margin:0;font-size:28px;line-height:1.2;letter-spacing:-.6px}',
    'header::after{content:"";display:block;width:48px;height:4px;border-radius:2px;background:var(--accent);margin:0 0 24px}header>p{color:var(--muted);margin:12px 0 24px}h2{margin:0 0 16px;font-size:20px;line-height:1.3;color:var(--ink)}p{margin:0 0 16px}',
    '.card{margin:0 0 24px;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:14px}',
    'label{display:block;margin:16px 0 8px;font-weight:650}select,button{font:inherit;min-height:44px;border-radius:8px}',
    'select{width:100%;padding:11px 10px;border:1px solid var(--line);background:var(--field);color:var(--ink)}',
    'select[aria-invalid=true]{border-color:var(--error);box-shadow:0 0 0 1px var(--error)}.inline-error{margin:16px 0 0;font-size:14px;color:var(--error)}',
    'button{padding:10px 12px;border:1px solid var(--line);background:var(--field);color:var(--ink);font-weight:650;cursor:pointer}',
    'button:disabled{opacity:.45;cursor:default}select:disabled{opacity:.6}button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}',
    '.hint{font-size:14px;color:var(--muted);margin:8px 0 0}.intro{color:var(--muted);font-size:14px}',
    'details>summary{min-height:44px;padding:10px 0;display:list-item;align-content:center;cursor:pointer;font-weight:650}details.card>summary{color:var(--ink);font-size:17px}details[open]>summary{margin-bottom:16px}',
    '.help ol{margin:12px 0 16px;padding-left:22px}.help li{padding-left:3px;margin:9px 0}.help p{color:var(--muted);font-size:14px}.help p:last-child{margin-bottom:0}',
    'footer{position:fixed;bottom:0;left:0;right:0;padding:12px 16px max(16px,env(safe-area-inset-bottom));background:var(--page);border-top:1px solid var(--line)}footer[data-flow=true]{position:static}',
    '.footer-inner{max-width:480px;margin:auto}.status{font-size:14px;color:var(--muted);text-align:left;margin:0 0 10px;min-height:20px}.status.error{color:var(--error)}',
    '.actions{display:flex;gap:8px}.actions button{flex:1;min-width:0;overflow-wrap:anywhere}footer[data-flow=true] .actions{flex-direction:column}#save{min-height:48px;background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}',
    'button,select{transition:background-color 144ms ease-out,border-color 144ms ease-out}button:not(:disabled):active{transform:translateY(1px)}details[open]>:not(summary){animation:disclose 160ms ease-out}@keyframes disclose{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){button,select{transition:none}button:not(:disabled):active{transform:none}details[open]>:not(summary){animation:none}}',
    '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}[hidden]{display:none!important}@media(max-width:340px){main{padding-left:12px;padding-right:12px}.card{padding-left:14px;padding-right:14px}footer{padding-left:12px;padding-right:12px}.actions button{font-size:15px}}',
    '@media(max-width:260px){.actions{flex-direction:column}select{min-width:0}main{padding-top:16px}}',
    '</style></head><body><main><header><h1>Open Activity</h1><p data-i18n="Choose a shortcut for each activity.">Choose a shortcut for each activity.</p></header>',
    '<form id="settings"><section class="card" aria-labelledby="shortcuts-heading"><h2 id="shortcuts-heading" data-i18n="Activity shortcuts">Activity shortcuts</h2>',
    picker('primary', 'Primary activity'), picker('secondary', 'Secondary activity'),
    '<p id="shortcut-error" class="inline-error" hidden></p><p id="assignment-help" class="intro" style="margin-top:20px"></p></section>',
    '<section class="card" aria-labelledby="appearance-heading"><h2 id="appearance-heading" data-i18n="Watch appearance">Watch appearance</h2><label class="sr-only" for="watch-theme" data-i18n="Watch appearance">Watch appearance</label><select id="watch-theme" disabled aria-describedby="watch-theme-help watch-delivery"><option value="" disabled hidden selected data-i18n="Loading saved choice…">Loading saved choice…</option><option value="light" data-i18n="Light">Light</option><option value="dark" data-i18n="Dark">Dark</option></select><p id="watch-theme-help" class="hint"></p><p id="watch-delivery" class="hint" data-i18n="Watch appearance will update when Open Activity next opens." hidden>Watch appearance will update when Open Activity next opens.</p></section>',
    '</form><details class="card help"><summary data-i18n="Setup & help">Setup &amp; help</summary><ol><li data-i18n="Install the current Dynamic build.">Install the current Dynamic build.</li><li data-i18n="Allow Open Activity to launch apps in the Pebble phone app.">Allow Open Activity to launch apps in the Pebble phone app.</li><li data-i18n="In Pebble’s Quick Launch settings, assign this same Open Activity app to each shortcut you want to use.">In Pebble’s Quick Launch settings, assign this same Open Activity app to each shortcut you want to use.</li></ol>',
    '<p data-i18n="Use one connected watch. This opens Dynamic’s recent selection, including briefly after changing watchfaces.">Use one connected watch. This opens Dynamic’s recent selection, including briefly after changing watchfaces.</p>',
    '<p data-i18n="A missing or expired activity returns to the watchface. It never substitutes Primary for a missing Secondary.">A missing or expired activity returns to the watchface. It never substitutes Primary for a missing Secondary.</p>',
    '<p data-i18n="These choices apply when the shortcut is assigned to Open Activity. Other Quick Launch assignments stay as you set them.">These choices apply when the shortcut is assigned to Open Activity. Other Quick Launch assignments stay as you set them.</p>',
    '<p data-i18n="Open Activity from the watch’s app list stays open for setup. Open its settings in the Pebble phone app, then press Back on the watch when finished. Assigned Quick Launch shortcuts still open activities automatically.">Open Activity from the watch’s app list stays open for setup. Open its settings in the Pebble phone app, then press Back on the watch when finished. Assigned Quick Launch shortcuts still open activities automatically.</p>',
    '<p data-i18n="Back cancels while Opening… is shown. A launch already sent to the phone may still finish.">Back cancels while Opening… is shown. A launch already sent to the phone may still finish.</p>',
    initial.mode === 'legacy' ? '<p class="hint" data-i18n="This legacy settings route closes after Save. Reopen settings to check the saved choices.">This legacy settings route closes after Save. Reopen settings to check the saved choices.</p>' : '',
    '</details></main><footer id="actions"><div class="footer-inner"><p id="status" class="status" role="status" aria-live="polite" data-i18n="Loading settings…">Loading settings…</p><div class="actions">',
    '<button id="retry" type="button" hidden data-i18n="Retry loading">Retry loading</button><button id="discard" type="button" disabled data-i18n="Discard">Discard</button><button id="save" type="submit" form="settings" disabled data-i18n="Save">Save</button>',
    '</div></div></footer><script>(', behavior.toString(), ')(', JSON.stringify(initial).replace(/</g, '\\u003c'), ');</script></body></html>'
  ].join('\n');
}
module.exports = function(settings, invalid, appearance) {
  var current = model.normalize(settings) || model.defaults();
  return render({mode: 'legacy', settings: model.choices(current), needsRepair: !!invalid, needsMigration: current.version === 1, appearance: appearance || uiModel.defaults(), needsAppearanceRepair: appearance === null});
};
module.exports.config = function() { return render({mode: 'plugin'}); };
