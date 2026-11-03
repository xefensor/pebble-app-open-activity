'use strict';

var KEY = 'open-activity-settings-v1';
function role(value) { return value === 'primary' || value === 'secondary'; }
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function only(value, allowed) {
  return Object.keys(value).every(function (key) { return allowed.indexOf(key) !== -1; });
}
function defaults() {
  return {version: 1, defaultRole: 'primary', holdOverrides: {up: 'secondary', down: 'primary'}};
}
function overrides(value, buttons) {
  if (!object(value) || !only(value, buttons)) return null;
  var output = {};
  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    if (!Object.prototype.hasOwnProperty.call(value, button)) continue;
    var choice = value[button];
    if (choice !== 'default' && !role(choice)) return null;
    if (choice !== 'default') output[button] = choice;
  }
  return output;
}
function normalize(value) {
  if (!object(value) || !only(value, ['version', 'defaultRole', 'holdOverrides', 'tapOverrides', 'comboOverrides']) ||
      value.version !== 1 || !role(value.defaultRole)) return null;
  var holds = overrides(value.holdOverrides, ['up', 'down', 'select', 'back']);
  var taps = value.tapOverrides === undefined ? {} : overrides(value.tapOverrides, ['up', 'down']);
  var combos = value.comboOverrides === undefined ? {} : overrides(value.comboOverrides, ['backUp', 'upDown']);
  if (!holds || !taps || !combos) return null;
  var output = {version: 1, defaultRole: value.defaultRole, holdOverrides: holds};
  if (Object.keys(taps).length) output.tapOverrides = taps;
  if (Object.keys(combos).length) output.comboOverrides = combos;
  return output;
}
function load(storage) {
  try {
    var value = storage.getItem(KEY);
    return value === null || value === undefined ? defaults() : normalize(JSON.parse(value));
  } catch (error) { return null; }
}
function save(storage, value) {
  var settings = normalize(value);
  if (!settings) return false;
  try {
    var encoded = JSON.stringify(settings);
    storage.setItem(KEY, encoded);
    return storage.getItem(KEY) === encoded;
  } catch (error) { return false; }
}
function select(settings, button, gesture) {
  if (gesture === undefined) gesture = 1; // Existing callers select hold mappings.
  if (!settings || !role(settings.defaultRole) || typeof button !== 'number' ||
      Math.floor(button) !== button || button < 0 || button > 3) return null;
  var name = {0: 'back', 1: 'up', 2: 'select', 3: 'down'}[button];
  var chosen;
  if (gesture === 1) chosen = settings.holdOverrides;
  else if (gesture === 2 && (button === 1 || button === 3)) chosen = settings.tapOverrides;
  else if (gesture === 3 && (button === 0 || button === 1)) {
    chosen = settings.comboOverrides;
    name = button === 0 ? 'backUp' : 'upDown';
  } else return null;
  return chosen && chosen[name] || settings.defaultRole;
}
module.exports = {key: KEY, defaults: defaults, normalize: normalize, load: load, save: save, select: select};
