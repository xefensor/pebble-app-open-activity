'use strict';
// Actual packaged HTML/config plugin in Chromium; only the SDK bridge/storage
// are simulated. Requires an existing local Chromium debugging endpoint.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const artifact = path.join(root, 'dist/Open-Activity-' + version + '.pbw');
const output = path.resolve(process.argv[2] || path.join(root, 'docs/qa', version, 'settings'));
const endpoint = process.env.OPEN_ACTIVITY_CHROMIUM_ENDPOINT || 'http://127.0.0.1:9229';
const files = JSON.parse(execFileSync('python3', ['-c',
  'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z: print(json.dumps({n:z.read(n).decode() for n in ["config.html","plugin.js"]}))', artifact], {encoding: 'utf8'}));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(files['config.html'], fs.readFileSync(path.join(root, 'config.html'), 'utf8'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'open-activity-ux-'));
fs.mkdirSync(output, {recursive: true});
function fixture(seed = {}, faults = {}) {
  const shim = '<script>(function(){window.__qa={store:' + JSON.stringify(seed) + ',requests:[],faults:' + JSON.stringify(faults) + '};' +
    'var handler;function cold(){(function(Pebble,localStorage){' + files['plugin.js'] +
    '\n})({registerConfigHandler:function(fn){handler=fn;}},{getItem:function(k){return Object.prototype.hasOwnProperty.call(__qa.store,k)?__qa.store[k]:null;},setItem:function(k,v){__qa.store[k]=v;}});}cold();' +
    'window.Pebble={addEventListener:function(name,fn){document.addEventListener("DOMContentLoaded",function(){fn({target:"plugin"});});},sendMessage:function(target,message){' +
    'if(target!=="plugin")throw Error("Unexpected target");__qa.requests.push(message);return new Promise(function(resolve,reject){' +
    'if(message.type==="getSettings"&&__qa.faults.load){__qa.faults.load--;reject(Error("load"));return;}' +
    'if(message.type==="saveSettings"&&__qa.faults.save){__qa.faults.save--;resolve({ok:false});return;}' +
    'if(message.type==="saveSettings"&&__qa.faults.ackLost){__qa.faults.ackLost--;handler(message,function(){reject(Error("lost acknowledgement"));});return;}' +
    'setTimeout(function(){handler(message,resolve);},__qa.faults.delay||0);});}};})();</script>';
  const name = path.join(scratch, 'page-' + crypto.randomBytes(4).toString('hex') + '.html');
  fs.writeFileSync(name, files['config.html'].replace('<script>', shim + '<script>'));
  return 'file://' + name;
}
async function run() {
  const tabs = await (await fetch(endpoint + '/json')).json();
  const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  const pending = new Map(), errors = []; let sequence = 0;
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) {const item = pending.get(data.id); pending.delete(data.id); data.error ? item.reject(data.error) : item.resolve(data.result);}
    else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    assert.equal(result.exceptionDetails, undefined, expression); return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) {if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 30));}
    throw Error('Timed out waiting for ' + expression);
  };
  const change = async (id, value) => evaluate('(()=>{const field=document.getElementById(' + JSON.stringify(id) + ');field.value=' + JSON.stringify(value) + ';field.dispatchEvent(new Event("change",{bubbles:true}));})()');
  const capture = async name => {
    const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const bytes = Buffer.from(shot.data, 'base64'); fs.writeFileSync(path.join(output, name), bytes);
    return {file: name, sha256: sha(bytes)};
  };
  await send('Page.enable'); await send('Runtime.enable');
  const captures = [], layouts = [], checks = [];
  for (const width of [320, 360]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 800, deviceScaleFactor: 1, mobile: true});
    await send('Page.navigate', {url: fixture()});
    await wait('!document.getElementById("up").disabled');
    assert.equal(await evaluate('document.getElementById("save").disabled'), true);
    assert.deepEqual(await evaluate('Object.keys(__qa.store)'), [], 'loading defaults never writes them');
    for (const theme of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
      captures.push(await capture('settings-' + width + '-' + theme + '.png'));
      const layout = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,targets:Array.from(document.querySelectorAll("button,select,summary")).filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent,height:e.getBoundingClientRect().height})),labelled:Array.from(document.querySelectorAll("select")).every(e=>document.querySelector("label[for="+e.id+"]")&&document.getElementById(e.getAttribute("aria-describedby"))),background:getComputedStyle(document.body).backgroundColor})');
      assert.ok(layout.scrollWidth <= width); assert.ok(layout.targets.every(target => target.height >= 44)); assert.equal(layout.labelled, true);
      layouts.push({width, theme, ...layout});
    }
  }
  checks.push('320/360 light/dark, labels/descriptions,44px targets,no horizontal overflow,unchanged save disabled,no writes on load');
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
  await evaluate('document.querySelector(".fallback").open=true');
  await change('up', 'default'); await change('role', 'secondary');
  assert.match(await evaluate('document.getElementById("up-help").textContent'), /smaller secondary/);
  assert.equal(await evaluate('Array.from(document.getElementById("up").options).find(o=>o.value==="default").textContent'), 'Use default (Secondary)');
  assert.equal(await evaluate('document.getElementById("save").disabled'), false);
  await evaluate('__qa.faults.delay=200;document.getElementById("save").click()');
  assert.equal(await evaluate('document.getElementById("save").textContent'), 'Saving…');
  assert.equal(await evaluate('document.getElementById("up").disabled'), true);
  await evaluate('document.getElementById("save").click()');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'), 1, 'only one save can be in flight');
  await wait('document.getElementById("status").textContent==="Settings saved."');
  const stored = await evaluate('__qa.store');
  const key = require('../src/pkjs/settings').key;
  assert.deepEqual(JSON.parse(stored[key]), {version: 1, defaultRole: 'secondary', holdOverrides: {down: 'primary'}});
  await evaluate('document.getElementById("save").click()');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'), 1);
  await send('Page.navigate', {url: fixture(stored)}); await wait('!document.getElementById("up").disabled');
  assert.equal(await evaluate('document.getElementById("role").value'), 'secondary');
  await change('down', 'secondary'); await evaluate('document.getElementById("discard").click()');
  await wait('!document.getElementById("up").disabled');
  assert.equal(await evaluate('document.getElementById("down").value'), 'primary');
  assert.equal(await evaluate('__qa.requests.some(m=>m.type==="saveSettings")'), false);
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="getSettings").length'), 1, 'discard does no backend work');
  checks.push('resolved Default,dirty/saving/saved states,one save,actual packaged plugin cold-read/write/reopen,discard without write');
  await send('Emulation.setDeviceMetricsOverride', {width: 320, height: 800, deviceScaleFactor: 1, mobile: true});
  await send('Page.navigate', {url: fixture(stored, {load: 1})});
  await wait('!document.getElementById("retry").hidden');
  assert.equal(await evaluate('document.getElementById("save").disabled'), true);
  assert.equal(await evaluate('document.getElementById("up").selectedOptions[0].textContent'), 'Not loaded');
  captures.push(await capture('load-error-320.png'));
  await evaluate('document.getElementById("retry").click()'); await wait('!document.getElementById("up").disabled');
  assert.deepEqual(await evaluate('__qa.store'), stored);
  await change('down', 'secondary'); await evaluate('__qa.faults.save=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  assert.equal(await evaluate('document.getElementById("down").value'), 'secondary');
  assert.equal(await evaluate('document.getElementById("discard").textContent'), 'Reload saved');
  assert.deepEqual(await evaluate('__qa.store'), stored);
  captures.push(await capture('save-error-320.png'));
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="Settings saved."');
  checks.push('load failure+retry preserves stored preferences; save failure retains draft and retries explicitly');
  await evaluate('document.querySelector(".fallback").open=true');
  await change('role', 'primary'); await evaluate('__qa.faults.ackLost=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  await change('role', 'secondary');
  assert.equal(await evaluate('document.getElementById("save").disabled'), false);
  const writes = await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length');
  await evaluate('document.getElementById("discard").click()'); await wait('document.getElementById("status").textContent==="Saved settings reloaded."');
  assert.equal(await evaluate('document.getElementById("role").value'), 'primary');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'), writes);
  checks.push('backend write with lost acknowledgement stays uncertain; explicit Reload saved reads the stored result without writing');
  await send('Page.navigate', {url: fixture({[key]: '{broken'})}); await wait('!document.getElementById("up").disabled');
  assert.equal(await evaluate('__qa.store[' + JSON.stringify(key) + ']'), '{broken');
  assert.equal(await evaluate('document.getElementById("save").disabled'), false);
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="Settings saved."');
  assert.deepEqual(JSON.parse(await evaluate('__qa.store[' + JSON.stringify(key) + ']')), require('../src/pkjs/settings').defaults());
  await evaluate('document.querySelector(".help").open=true;document.querySelector(".help").scrollIntoView({block:"start"})');
  captures.push(await capture('setup-help-320.png'));
  checks.push('unreadable preferences require explicit repair Save; setup/help disclosure and fixed save area');
  assert.deepEqual(errors, []);
  const report = {version, result: 'PASS', pbw: {file: path.basename(artifact), sha256: sha(fs.readFileSync(artifact))},
    executedPackagedFiles: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)])),
    captures, layouts, checks, errors,
    scope: 'Actual packaged offline config HTML and config-only plugin in installed Chromium. Mock SDK bridge and isolated in-memory settings; no native lifetime, real phone WebView or physical-watch Quick Launch claim.'};
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  socket.close(); fs.rmSync(scratch, {recursive: true, force: true});
  console.log(JSON.stringify({result: 'PASS', output, captures: captures.length, checks}, null, 2));
}
run().catch(error => {console.error(error); process.exitCode = 1;});
