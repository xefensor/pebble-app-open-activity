'use strict';

// UI preferences are independent of the version-1/version-2 shortcut record.
// Reading or changing appearance never rewrites legacy routing bytes.
var KEY = 'open-activity-ui-v1';
function defaults() { return {version: 1, theme: 'light'}; }
function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 ||
      Object.keys(value).some(function(key) { return key !== 'version' && key !== 'theme'; }) ||
      value.theme !== 'light' && value.theme !== 'dark') return null;
  return {version: 1, theme: value.theme};
}
function load(storage) {
  try {
    var raw = storage.getItem(KEY);
    return raw === null || raw === undefined ? defaults() : normalize(JSON.parse(raw));
  } catch (error) { return null; }
}
function save(storage, value) {
  var normalized = normalize(value);
  if (!normalized) return false;
  try {
    var encoded = JSON.stringify(normalized);
    if (storage.getItem(KEY) !== encoded) storage.setItem(KEY, encoded);
    return storage.getItem(KEY) === encoded;
  } catch (error) { return false; }
}
module.exports = {key: KEY, defaults: defaults, normalize: normalize, load: load, save: save};
