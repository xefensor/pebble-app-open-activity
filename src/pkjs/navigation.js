'use strict';

var DYNAMIC = 'cc1281f1-3b4d-45b5-b235-6881b1fd8fbd';
var HELPER = 'd2d0bf48-cf4c-42f6-8b5f-3657fb2de4e9';
var ZERO = '00000000-0000-0000-0000-000000000000';
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function exact(value, fields) {
  return object(value) && Object.keys(value).length === fields.length &&
    Object.keys(value).every(function (key) { return fields.indexOf(key) !== -1; });
}
function integer(value, minimum, maximum) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
    value >= minimum && value <= maximum;
}
function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== ZERO;
}
function utf8Bytes(text) {
  var size = 0;
  for (var i = 0; i < text.length; ++i) {
    var ch = text.charCodeAt(i);
    if (ch < 0x80) ++size;
    else if (ch < 0x800) size += 2;
    else if (ch >= 0xd800 && ch <= 0xdbff) {
      if (++i >= text.length || text.charCodeAt(i) < 0xdc00 || text.charCodeAt(i) > 0xdfff) return Infinity;
      size += 4;
    } else if (ch >= 0xdc00 && ch <= 0xdfff) return Infinity;
    else size += 3;
  }
  return size;
}
function destination(value) {
  return value === null || (exact(value, ['watchAppUuid']) && uuid(value.watchAppUuid) && value.watchAppUuid !== HELPER);
}
function parseHint(text, now) {
  // Every UTF-16 code unit needs at least one UTF-8 byte. Bound untrusted
  // input before walking it, while retaining exact UTF-8/surrogate validation.
  if (typeof text !== 'string' || text.length > 512 || utf8Bytes(text) > 512) return null;
  var hint;
  try { hint = JSON.parse(text); } catch (error) { return null; }
  if (!exact(hint, ['schema', 'watchfaceUuid', 'nativeSession', 'viewSequence',
      'presentationSequence', 'presentedAtMs', 'expiresAtMs', 'primary', 'secondary']) ||
      hint.schema !== 1 || hint.watchfaceUuid !== DYNAMIC ||
      !integer(hint.nativeSession, 1, 4294967295) ||
      !integer(hint.viewSequence, 1, 4294967295) ||
      !integer(hint.presentationSequence, 1, 4294967295) ||
      !integer(hint.presentedAtMs, 1, 9007199254740991) ||
      !integer(hint.expiresAtMs, 1, 9007199254740991) ||
      !integer(now, 1, 9007199254740991) || hint.presentedAtMs > now ||
      hint.expiresAtMs <= now || hint.expiresAtMs <= hint.presentedAtMs ||
      hint.expiresAtMs - hint.presentedAtMs > 45000 ||
      !destination(hint.primary) || !destination(hint.secondary)) return null;
  return hint;
}
function resolve(envelope, role, now) {
  if ((role !== 'primary' && role !== 'secondary') || !object(envelope) ||
      envelope.pluginUuid !== DYNAMIC || !integer(envelope.validUntilMs, 1, 9007199254740991) ||
      envelope.validUntilMs <= now || !Array.isArray(envelope.instances) || envelope.instances.length !== 1) return null;
  var instance = envelope.instances[0];
  if (!object(instance) || instance.instanceId !== 'current' || !object(instance.properties) ||
      !object(instance.properties.hint) || !object(instance.properties.hint.longText)) return null;
  var hint = parseHint(instance.properties.hint.longText.text, now);
  if (!hint || envelope.validUntilMs > hint.expiresAtMs || !hint[role]) return null;
  return {watchAppUuid: hint[role].watchAppUuid, expiresAtMs: Math.min(hint.expiresAtMs, envelope.validUntilMs)};
}
module.exports = {dynamicUuid: DYNAMIC, helperUuid: HELPER, uuid: uuid, utf8Bytes: utf8Bytes, parseHint: parseHint, resolve: resolve};
