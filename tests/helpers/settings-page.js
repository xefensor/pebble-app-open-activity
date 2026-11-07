'use strict';
const vm = require('node:vm');
const assert = require('node:assert/strict');
module.exports = function mount(html, reply, viewport) {
  const elements = {};
  for (const id of ['primary', 'secondary', 'watchface', 'settings', 'save', 'discard', 'retry', 'status', 'actions', 'shortcut-error', 'assignment-help', 'primary-help', 'secondary-help', 'watch-theme', 'watch-theme-help', 'watch-delivery']) {
    const select = html.match(new RegExp('<select[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)<\\/select>'));
    const options = select ? [...select[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(match => ({value: match[1], textContent: match[2]})) : [];
    elements[id] = {id, value: '', disabled: true, hidden: false, textContent: '', options, className: '',
      attributes: {}, setAttribute(name, value) {this.attributes[name] = value;}, removeAttribute(name) {delete this.attributes[name];},
      setCustomValidity(value) {this.validationMessage = value;}};
  }
  const requests = [], timers = new Map(), location = {href: ''};
  const frames = [], geometry = {reads: 0, attributeWrites: 0, styleWrites: 0};
  const resize = {}, visualResize = {};
  let observed;
  const browser = viewport ? {
    window: {innerHeight: viewport.height, visualViewport: {height: viewport.height,
      addEventListener(name, callback) {visualResize[name] = callback;}},
      addEventListener(name, callback) {resize[name] = callback;}, requestAnimationFrame(callback) {frames.push(callback);}},
    ResizeObserver: function(callback) {observed = callback; this.observe = function() {};}
  } : {};
  if (viewport) {
    elements.actions.getBoundingClientRect = () => {geometry.reads++; return {height: viewport.actionsHeight};};
    const set = elements.actions.setAttribute;
    elements.actions.setAttribute = function(name, value) {geometry.attributeWrites++; set.call(this, name, value);};
  }
  let ready, next = 1;
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, Object.assign({
    document: {getElementById(id) {assert.ok(elements[id], id); return elements[id];},
      documentElement: {style: {setProperty() {geometry.styleWrites++;}}}}, location,
    setTimeout(callback) {const id = next++; timers.set(id, callback); return id;},
    clearTimeout(id) {timers.delete(id);},
    Pebble: {addEventListener(event, handler) {assert.equal(event, 'ready'); ready = handler;},
      sendMessage(target, message) {assert.equal(target, 'plugin'); requests.push(message); return reply(message);}}
  }, browser), {timeout: 2000});
  return {elements, requests, location, ready: target => ready({target: target || 'plugin'}),
    timeout() {const callback = [...timers.values()].pop(); assert.ok(callback); timers.clear(); callback();},
    change(id, value) {elements[id].value = value; elements[id].onchange();},
    tick: async () => {await Promise.resolve(); await Promise.resolve();}, geometry,
    frame() {const work = frames.splice(0); work.forEach(callback => callback());},
    resize() {resize.resize(); visualResize.resize(); observed();}};
};
