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
function normalize(value) {
  if (!object(value) || !only(value, ['version', 'defaultRole', 'holdOverrides']) ||
      value.version !== 1 || !role(value.defaultRole) || !object(value.holdOverrides) ||
      !only(value.holdOverrides, ['up', 'down'])) return null;
  var output = {version: 1, defaultRole: value.defaultRole, holdOverrides: {}};
  var valid = Object.keys(value.holdOverrides).every(function (button) {
    var choice = value.holdOverrides[button];
    if (choice !== 'default' && !role(choice)) return false;
    if (choice !== 'default') output.holdOverrides[button] = choice;
    return true;
  });
  return valid ? output : null;
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
function select(settings, button) {
  if (!settings || !role(settings.defaultRole) || typeof button !== 'number' ||
      Math.floor(button) !== button || button < 0 || button > 3) return null;
  var name = {0: 'back', 1: 'up', 2: 'select', 3: 'down'}[button];
  if (!name) return null;
  return settings.holdOverrides[name] || settings.defaultRole;
}
module.exports = {key: KEY, defaults: defaults, normalize: normalize, load: load, save: save, select: select};
