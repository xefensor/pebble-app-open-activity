'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
module.exports = function mount(html, reply) {
  const elements = {};
  for (const id of ['primary', 'secondary', 'settings', 'save', 'discard', 'retry', 'status', 'primary-help', 'secondary-help']) {
    const select = html.match(new RegExp('<select[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)<\\/select>'));
    const options = select ? [...select[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(match => ({value: match[1], textContent: match[2]})) : [];
    elements[id] = {id, value: '', disabled: true, hidden: false, textContent: '', options, className: '',
      attributes: {}, setAttribute(name, value) {this.attributes[name] = value;}, removeAttribute(name) {delete this.attributes[name];},
      setCustomValidity(value) {this.validationMessage = value;}};
  }
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
