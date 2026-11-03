'use strict';

var KEY = 'open-activity-settings-v1';
var SHORTCUTS = [
  {id: 'hold-up', label: 'Hold Up', button: 1, gesture: 1},
  {id: 'hold-select', label: 'Hold Center', button: 2, gesture: 1},
  {id: 'hold-down', label: 'Hold Down', button: 3, gesture: 1},
  {id: 'hold-back', label: 'Hold Back', button: 0, gesture: 1},
  {id: 'tap-up', label: 'Tap Up', button: 1, gesture: 2},
  {id: 'tap-down', label: 'Tap Down', button: 3, gesture: 2},
  {id: 'combo-back-up', label: 'Hold Back + Up', button: 0, gesture: 3},
  {id: 'combo-up-down', label: 'Hold Up + Down', button: 1, gesture: 3}
];
function role(value) { return value === 'primary' || value === 'secondary'; }
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function only(value, allowed) {
  return Object.keys(value).every(function (key) { return allowed.indexOf(key) !== -1; });
}
function defaults() {
  return {version: 2, primaryShortcut: 'hold-down', secondaryShortcut: 'hold-up'};
}
function shortcutId(value) {
  if (value === 'none') return true;
  return SHORTCUTS.some(function (shortcut) { return shortcut.id === value; });
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
  if (!object(value)) return null;
  if (value.version === 2) {
    if (!only(value, ['version', 'primaryShortcut', 'secondaryShortcut']) ||
        !shortcutId(value.primaryShortcut) || !shortcutId(value.secondaryShortcut) ||
        value.primaryShortcut !== 'none' && value.primaryShortcut === value.secondaryShortcut) return null;
    return {version: 2, primaryShortcut: value.primaryShortcut, secondaryShortcut: value.secondaryShortcut};
  }
  if (!only(value, ['version', 'defaultRole', 'holdOverrides', 'tapOverrides', 'comboOverrides']) ||
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
function legacyOverride(settings, shortcut) {
  var name = {0: 'back', 1: 'up', 2: 'select', 3: 'down'}[shortcut.button];
  var chosen;
  if (shortcut.gesture === 1) chosen = settings.holdOverrides;
  else if (shortcut.gesture === 2) chosen = settings.tapOverrides;
  else {
    chosen = settings.comboOverrides;
    name = shortcut.button === 0 ? 'backUp' : 'upDown';
  }
  return chosen && chosen[name];
}
function select(value, button, gesture) {
  if (gesture === undefined) gesture = 1; // Existing callers select hold mappings.
  var settings = normalize(value), shortcut;
  if (!settings || typeof button !== 'number' || Math.floor(button) !== button) return null;
  for (var i = 0; i < SHORTCUTS.length; i++) {
    if (SHORTCUTS[i].button === button && SHORTCUTS[i].gesture === gesture) shortcut = SHORTCUTS[i];
  }
  if (!shortcut) return null;
  if (settings.version === 1) return legacyOverride(settings, shortcut) || settings.defaultRole;
  if (shortcut.id === settings.primaryShortcut) return 'primary';
  if (shortcut.id === settings.secondaryShortcut) return 'secondary';
  return null;
}
function choices(value) {
  var settings = normalize(value);
  if (!settings || settings.version === 2) return settings;
  function choose(target, preferred) {
    var matched = SHORTCUTS.filter(function (shortcut) {
      return (legacyOverride(settings, shortcut) || settings.defaultRole) === target;
    });
    var explicit = matched.filter(function (shortcut) { return legacyOverride(settings, shortcut) === target; });
    var preferredExplicit = explicit.filter(function (shortcut) { return shortcut.id === preferred; });
    var preferredDefault = matched.filter(function (shortcut) { return shortcut.id === preferred; });
    var selected = preferredExplicit[0] || explicit[0] || preferredDefault[0] || matched[0];
    return selected ? selected.id : 'none';
  }
  return {version: 2, primaryShortcut: choose('primary', 'hold-down'), secondaryShortcut: choose('secondary', 'hold-up')};
}
module.exports = {key: KEY, shortcuts: SHORTCUTS, defaults: defaults, normalize: normalize,
  choices: choices, load: load, save: save, select: select};
