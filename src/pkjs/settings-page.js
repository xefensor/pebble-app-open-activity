'use strict';

var settingsStyle = require('pebble-xoce-ui/settings-style');

var model = require('./settings');
var uiModel = require('./ui-settings');
var translations = require('./settings-i18n');

// Both settings paths use this layout. The build writes config.html from it.
function behavior(initial) {
  'use strict';
  var primary = document.getElementById('primary'), secondary = document.getElementById('secondary');
  var watchface = document.getElementById('watchface');
  var size=document.getElementById('text-size'),deliveryRetry=document.getElementById('delivery-retry');
  var preferencesSupported=false,savedPreferences='',lastExplicit='light',preferenceDelivery=null,preferenceUncommitted=false,preferencePoll=null;
  var theme = document.getElementById('watch-theme'), delivery = document.getElementById('watch-delivery');
  var appearanceSupported = false, appearanceRepair = false, savedAppearance = '';
  var locale = String(typeof navigator !== 'undefined' && navigator.language || 'en').toLowerCase().split(/[_.@-]/)[0];
  if (locale === 'nb' || locale === 'nn') locale = 'no';
  if (!initial.translations[locale]) locale = 'en';
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
        Object.keys(value).some(function(name) { return ['version','primaryShortcut','secondaryShortcut','watchface'].indexOf(name) === -1; }) ||
        value.watchface !== undefined && value.watchface !== 'dynamic' && value.watchface !== 'halftone' ||
        !shortcut(value.primaryShortcut) || !shortcut(value.secondaryShortcut) ||
        value.primaryShortcut !== 'none' && value.primaryShortcut === value.secondaryShortcut) return null;
    var chosen = {version: 2, primaryShortcut: value.primaryShortcut, secondaryShortcut: value.secondaryShortcut};
    if (value.watchface === 'halftone') chosen.watchface = 'halftone';
    return chosen;
  }
  function normalizeAppearance(value) {
    if (!value || value.version !== 1 || value.theme !== 'light' && value.theme !== 'dark' ||
        Object.keys(value).some(function(key) { return key !== 'version' && key !== 'theme'; })) return null;
    return {version: 1, theme: value.theme};
  }
  function normalizePreferences(value){
    return value&&value.version===2&&Object.keys(value).length===4&&['follow','small','medium','large'].indexOf(value.textSize)>=0&&['follow','light','dark'].indexOf(value.appearance)>=0&&['light','dark'].indexOf(value.lastExplicit)>=0&&(value.appearance==='follow'||value.appearance===value.lastExplicit)?{version:2,textSize:value.textSize,appearance:value.appearance,lastExplicit:value.lastExplicit}:null;
  }
  function preferenceValue(){return preferencesSupported?normalizePreferences({version:2,textSize:size.value,appearance:theme.value,lastExplicit:lastExplicit}):undefined;}
  function appearanceValue() { return appearanceSupported ? normalizeAppearance({version:1,theme:theme.value==='follow'?lastExplicit:theme.value}) : undefined; }
  function stopPreferencePoll(){if(preferencePoll!==null)clearTimeout(preferencePoll);preferencePoll=null;}
  function showPreferenceDelivery(){
    stopPreferencePoll();if(!preferencesSupported)return;
    delivery.hidden=false;
    delivery.textContent=tr(preferenceUncommitted||JSON.stringify(preferenceValue())!==savedPreferences?'Unsaved changes.':preferenceDelivery&&preferenceDelivery.applied?'Applied on watch':preferenceDelivery&&preferenceDelivery.error?'Saved on phone · Watch could not confirm saving':'Saved on phone · Pending on watch');
    deliveryRetry.hidden=legacy||dirty()||!!(preferenceDelivery&&preferenceDelivery.applied);
    if(!legacy&&loaded&&phase==='ready'&&!dirty())preferencePoll=setTimeout(function(){preferencePoll=null;pollPreferences(false);},preferenceDelivery&&preferenceDelivery.applied?5000:2000);
    layoutActions();
  }
  function pollPreferences(force){
    if(!loaded||phase!=='ready'||dirty())return;
    settingsTarget(function(target){request({type:force?'retryUiPreferences':'getUiPreferences'},function(response){
      if(!dirty()&&response&&response.ok&&JSON.stringify(normalizePreferences(response.settings))===savedPreferences){preferenceDelivery=response.delivery;showPreferenceDelivery();}
    },showPreferenceDelivery,target);},showPreferenceDelivery);
  }
  deliveryRetry.onclick=function(){stopPreferencePoll();pollPreferences(true);};
  function value() {
    return normalize({version: 2, primaryShortcut: primary.value, secondaryShortcut: secondary.value, watchface: watchface.value});
  }
  function edited() { return loaded && (JSON.stringify(value()) !== saved || appearanceSupported && JSON.stringify(appearanceValue()) !== savedAppearance || preferencesSupported&&JSON.stringify(preferenceValue())!==savedPreferences); }
  function dirty() { return loaded && (repairing || appearanceRepair || preferenceUncommitted || migrating || uncertain || edited()); }
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
    document.getElementById('watch-theme-help').textContent = tr(preferencesSupported?'Follow Pebble appearance is unavailable on this build. It uses your last Light or Dark choice.':appearanceSupported ? 'Watch colours are independent of this phone page.' : 'Update Open Activity to change watch appearance.');
  }
  function controls() {
    var editing = loaded && phase !== 'saving';
    fields.forEach(function(field) { field.disabled = !editing; });
    watchface.disabled = !editing;
    theme.disabled = !editing || !appearanceSupported;size.disabled=!editing||!preferencesSupported;
    for(var i=0;i<theme.options.length;++i)if(theme.options[i].value==='follow')theme.options[i].disabled=!preferencesSupported;
    deliveryRetry.hidden=!preferencesSupported||legacy||dirty()||!!(preferenceDelivery&&preferenceDelivery.applied);deliveryRetry.disabled=phase!=='ready';
    save.disabled = !editing || !dirty() || !value() || appearanceSupported && !appearanceValue();
    save.textContent = tr(phase === 'saving' ? 'Saving…' : 'Save');
    discard.hidden = !legacy && !loaded;
    discard.disabled = phase === 'saving' || !legacy && !uncertain && !edited();
    discard.textContent = tr(legacy ? 'Cancel' : uncertain ? 'Reload saved' : 'Discard');
    retry.hidden = phase !== 'load-error'; describe();
  }
  function changed() {
    if(theme.value&&theme.value!=='follow')lastExplicit=theme.value;
    stopPreferencePoll();controls();showPreferenceDelivery();
    message(!value() ? 'Choose a different shortcut for each activity.' : uncertain ? 'Save not confirmed. Reload saved choices or save again.' :
      edited() ? 'Unsaved changes.' : repairing || appearanceRepair ? 'Review these choices and save to repair unreadable settings.' :
      migrating ? 'Save to use these two shortcuts.' : 'No changes to save.', !value() || uncertain);
  }
  function apply(settings, repair, migration, appearance, repairAppearance,preferences) {
    primary.value = settings.primaryShortcut; secondary.value = settings.secondaryShortcut;
    watchface.value = settings.watchface || 'dynamic';
    var normalizedAppearance = normalizeAppearance(appearance);
    appearanceSupported = !!normalizedAppearance; appearanceRepair = repairAppearance === true;
    var display=normalizePreferences(preferences&&preferences.settings);preferencesSupported=!!display;
    lastExplicit=display?display.lastExplicit:normalizedAppearance?normalizedAppearance.theme:'light';
    size.value=display?display.textSize:'';theme.value=display?display.appearance:normalizedAppearance?normalizedAppearance.theme:'';
    savedPreferences=display?JSON.stringify(display):'';preferenceDelivery=preferences&&preferences.delivery||null;preferenceUncommitted=!!(preferences&&preferences.saved===false);
    if(preferences&&preferences.needsRepair)appearanceRepair=true;
    savedAppearance = normalizedAppearance ? JSON.stringify(normalizedAppearance) : '';
    delivery.hidden = true;
    loaded = true; repairing = repair; migrating = migration; uncertain = false; saved = JSON.stringify(settings); phase = 'ready';
    controls();showPreferenceDelivery();
    message(repair || appearanceRepair ? 'Saved settings could not be read. Review these choices before saving.' : migration ? 'Save to use these two shortcuts.' : preferenceUncommitted?'Unsaved changes.':'No changes to save.', repair || appearanceRepair);
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
    stopPreferencePoll();loaded = false; phase = 'loading';
    fields.forEach(function(field) { field.value = ''; }); theme.value = ''; watchface.value = '';
    controls(); message('Loading settings…');
    if (!bridgeReady) { stopTimer(); timer = setTimeout(loadFailed, 6000); return; }
    settingsTarget(function(target){request({type: 'getSettings', uiVersion: 1,includeUiPreferences:true}, function(response) {
      var settings = response && response.ok === true && normalize(response.settings);
      if (!settings || response.appearance !== undefined && !normalizeAppearance(response.appearance)) { loadFailed(); return; }
      apply(settings, response.needsRepair === true, response.needsMigration === true, response.appearance, response.needsAppearanceRepair,response.preferences);
      if (readback && !repairing && !appearanceRepair) message('Saved settings reloaded.');
    }, loadFailed,target);},loadFailed);
  }
  fields.forEach(function(field) { field.onchange = changed;
    for (var i = 0; i < field.options.length; i++) field.options[i].textContent = tr(field.options[i].textContent);
  });
  theme.onchange = size.onchange=changed;
  watchface.onchange = changed;
  retry.onclick = load;
  discard.onclick = function() {
    if (legacy) location.href = 'pebblejs://close#';
    else if (loaded && uncertain) load();
    else if (loaded) apply(JSON.parse(saved), repairing, migrating, savedAppearance ? JSON.parse(savedAppearance) : undefined, appearanceRepair,preferencesSupported?{settings:JSON.parse(savedPreferences),delivery:preferenceDelivery,saved:!preferenceUncommitted}:undefined);
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
    var selectedAppearance = appearanceValue(),selectedPreferences=preferenceValue();
    if (legacy) { location.href = 'pebblejs://close#' + encodeURIComponent(JSON.stringify(selectedAppearance ? {uiVersion: 1, settings: selected, appearance: selectedAppearance,preferences:selectedPreferences} : selected)); return; }
    stopPreferencePoll();phase = 'saving'; controls(); message('Saving…');
    var attempts = 0;
    function confirmed(settings, response) {
      apply(settings,false,false,selectedAppearance,false,response.preferences);message('✓ Saved');
      if(!preferencesSupported)delivery.hidden=!selectedAppearance||response.watchDelivery!=='deferred';
    }
    function write(target) {
      if (++attempts > 3) { saveFailed(); return; }
      var payload = {type: 'saveSettings', settings: selected};
      if (selectedAppearance) { payload.uiVersion = 1; payload.appearance = selectedAppearance; }
      if(selectedPreferences)payload.preferences=selectedPreferences;
      request(payload, function(response) {
        if (response && response.ok === false && response.rejected === true) {
          uncertain = false; phase = 'ready'; controls(); message('Couldn’t save. Try again.', true); return;
        }
        var accepted = response && response.ok === true && normalize(response.settings);
        if (!accepted || JSON.stringify(accepted) !== JSON.stringify(selected) || selectedAppearance &&
            JSON.stringify(normalizeAppearance(response.appearance)) !== JSON.stringify(selectedAppearance)||selectedPreferences&&(!response.preferences||!response.preferences.ok||JSON.stringify(normalizePreferences(response.preferences.settings))!==JSON.stringify(selectedPreferences))) { saveFailed(); return; }
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
  if (legacy) apply(initial.settings, initial.needsRepair, initial.needsMigration, initial.appearance, initial.needsAppearanceRepair,initial.preferences);
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
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Activity</title><style id="xoce-settings-style">',
    settingsStyle,
    '</style><style>',
    ':root{--accent:#6f42a9;--accent-ink:#fff}',
    '@media(prefers-color-scheme:dark){:root{--accent:#c9a7ff;--accent-ink:#211332}}',
    'select[aria-invalid=true]{border-color:var(--error);box-shadow:0 0 0 1px var(--error)}.inline-error{margin:16px 0 0;font-size:14px;color:var(--error)}.intro{color:var(--muted);font-size:14px}',
    '.help ol{margin:12px 0 16px;padding-left:22px}.help li{padding-left:3px;margin:9px 0}.help p{color:var(--muted);font-size:14px}.help p:last-child{margin-bottom:0}',
    '</style></head><body><main><header><h1>Open Activity</h1><p data-i18n="Choose a shortcut for each activity.">Choose a shortcut for each activity.</p></header>',
    '<form id="settings"><section class="card" aria-labelledby="watchface-heading"><h2 id="watchface-heading" data-i18n="Watchface">Watchface</h2><label class="sr-only" for="watchface" data-i18n="Watchface">Watchface</label><select id="watchface" disabled aria-describedby="watchface-help"><option value="" disabled hidden selected data-i18n="Loading saved choice…">Loading saved choice…</option><option value="dynamic">Dynamic</option><option value="halftone">Halftone</option></select><p id="watchface-help" class="hint" data-i18n="Open activities shown by this watchface. Change this choice when you switch watchfaces.">Open activities shown by this watchface. Change this choice when you switch watchfaces.</p></section>',
    '<section class="card" aria-labelledby="shortcuts-heading"><h2 id="shortcuts-heading" data-i18n="Activity shortcuts">Activity shortcuts</h2>',
    picker('primary', 'Primary activity'), picker('secondary', 'Secondary activity'),
    '<p id="shortcut-error" class="inline-error" hidden></p><p id="assignment-help" class="intro" style="margin-top:20px"></p></section>',
    '<section class="card" aria-labelledby="appearance-heading"><h2 id="appearance-heading" data-i18n="Watch appearance">Watch appearance</h2><label for="text-size" data-i18n="Text size">Text size</label><select id="text-size" disabled aria-describedby="text-size-help"><option value="" disabled hidden selected data-i18n="Loading saved choice…">Loading saved choice…</option><option value="follow" data-i18n="Follow Pebble">Follow Pebble</option><option value="small" data-i18n="Small">Small</option><option value="medium" data-i18n="Medium">Medium</option><option value="large" data-i18n="Large">Large</option></select><p id="text-size-help" class="hint" data-i18n="Follow Pebble uses your watch’s text size.">Follow Pebble uses your watch’s text size.</p><label for="watch-theme" data-i18n="Watch appearance">Watch appearance</label><select id="watch-theme" disabled aria-describedby="watch-theme-help watch-delivery"><option value="" disabled hidden selected data-i18n="Loading saved choice…">Loading saved choice…</option><option value="follow" data-i18n="Follow Pebble">Follow Pebble</option><option value="light" data-i18n="Light">Light</option><option value="dark" data-i18n="Dark">Dark</option></select><p id="watch-theme-help" class="hint"></p><p class="hint" data-i18n="Launch Open Activity from your watch’s app list to apply display settings.">Launch Open Activity from your watch’s app list to apply display settings.</p><p id="watch-delivery" class="hint" data-i18n="Watch appearance will update when Open Activity next opens." hidden>Watch appearance will update when Open Activity next opens.</p><button id="delivery-retry" type="button" data-i18n="Retry watch delivery" hidden>Retry watch delivery</button></section>',
    '</form><details class="card help"><summary data-i18n="Setup & help">Setup &amp; help</summary><ol><li data-i18n="Install the current build of your selected watchface.">Install the current build of your selected watchface.</li><li data-i18n="Allow Open Activity to launch apps in the Pebble phone app.">Allow Open Activity to launch apps in the Pebble phone app.</li><li data-i18n="In Pebble’s Quick Launch settings, assign this same Open Activity app to each shortcut you want to use.">In Pebble’s Quick Launch settings, assign this same Open Activity app to each shortcut you want to use.</li></ol>',
    '<p data-i18n="Use one connected watch. This opens the selected watchface’s recent activity. It does not switch sources automatically.">Use one connected watch. This opens the selected watchface’s recent activity. It does not switch sources automatically.</p>',
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
module.exports = function(settings, invalid, appearance,preferences) {
  var current = model.normalize(settings) || model.defaults();
  return render({mode:'legacy',preferences:preferences,settings: model.choices(current), needsRepair: !!invalid, needsMigration: current.version === 1, appearance: appearance || uiModel.defaults(), needsAppearanceRepair: appearance === null});
};
module.exports.config = function() { return render({mode: 'plugin'}); };
