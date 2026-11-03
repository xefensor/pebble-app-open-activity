'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
module.exports = function mount(html, reply) {
  const elements = {};
  for (const id of ['up','down','select','back','tap-up','tap-down','combo-back-up','combo-up-down','role','settings','save','discard','retry','status','up-help','down-help','select-help','back-help','tap-up-help','tap-down-help','combo-back-up-help','combo-up-down-help','default-help'])
    elements[id] = {id, value: id === 'role' ? 'primary' : 'default', disabled: true, hidden: false,
      textContent: '', options: [{value: '', textContent: ''}, {value: 'default', textContent: ''}], className: ''};
  const requests = [], timers = new Map(), location = {href: ''};
  let ready, next = 1;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document: {getElementById(id) {assert.ok(elements[id], id); return elements[id];}}, location,
    setTimeout(callback) {const id = next++; timers.set(id, callback); return id;},
    clearTimeout(id) {timers.delete(id);},
    Pebble: {addEventListener(event, handler) {assert.equal(event, 'ready'); ready = handler;},
      sendMessage(target, message) {assert.equal(target, 'plugin'); requests.push(message); return reply(message);}}
  }, {timeout: 2000});
  return {elements, requests, location, ready: target => ready({target: target || 'plugin'}),
    timeout() {const callback = [...timers.values()].pop(); assert.ok(callback); timers.clear(); callback();},
    change(id, value) {elements[id].value = value; elements[id].onchange();},
    tick: async () => {await Promise.resolve(); await Promise.resolve();}};
};
