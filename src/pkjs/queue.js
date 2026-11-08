'use strict';

// One bounded AppMessage queue. Opening messages never retry; the display
// controller may retry only after passive setup has been identified.
module.exports = function (send) {
  var pending = [], busy = false;
  function flush() {
    if (busy || !pending.length) return;
    var item = pending.shift(), settled = false;
    busy = true;
    function done(ok) {
      if (settled) return;
      settled = true; busy = false;
      if (ok && item.success) item.success();
      if (!ok && item.failure) item.failure();
      flush();
    }
    try { send(item.message, function () { done(true); }, function () { done(false); }); }
    catch (error) { done(false); }
  }
  return {
    send: function (message, success, failure) {
      if (pending.length >= 4) { if (failure) failure(); return false; }
      pending.push({message: message, success: success, failure: failure}); flush(); return true;
    },
    clear: function () { pending = []; }
  };
};
