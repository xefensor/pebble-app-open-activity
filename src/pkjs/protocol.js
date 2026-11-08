'use strict';

var keys = {
  OA_OPERATION: 2000, OA_SESSION: 2001, OA_BUTTON: 2002,
  OA_ROLE: 2003, OA_DESTINATION: 2004, OA_ELAPSED_MS: 2005, OA_TICKET: 2006,
  OA_GESTURE: 2007, OA_THEME: 2008, OA_UI_PREFERENCES: 2009, OA_UI_PREFERENCES_RESULT: 2010
};
module.exports = {
  keys: keys,
  operation: {REQUEST: 1, HELLO: 2, PREPARE: 3, CONFIRM: 4, CLOSE: 5, CANCEL: 6, SETTINGS: 7},
  button: {back: 0, up: 1, select: 2, down: 3},
  gesture: {hold: 1, tap: 2, combo: 3},
  role: {primary: 1, secondary: 2},
  budgetMs: 4000,
  get: function (message, name) {
    if (!message) return undefined;
    return message[name] === undefined ? message[keys[name]] : message[name];
  },
  message: function (operation, values) {
    var output = {}; output[keys.OA_OPERATION] = operation;
    Object.keys(values || {}).forEach(function (name) { output[keys[name]] = values[name]; });
    return output;
  }
};
