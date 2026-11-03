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
let activeSocket;
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
  activeSocket = socket;
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
  let layoutWork;
  const key = require('../src/pkjs/settings').key;
  const pair = (primary = 'hold-down', secondary = 'hold-up') => ({version:2,primaryShortcut:primary,secondaryShortcut:secondary});
  const ids = ['hold-up','hold-select','hold-down','hold-back','tap-up','tap-down','combo-back-up','combo-up-down'];
  for (const width of [320, 360]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:800, deviceScaleFactor:1, mobile:true});
    await send('Page.navigate', {url:fixture()});
    await wait('!document.getElementById("primary").disabled');
    assert.equal(await evaluate('document.getElementById("save").disabled'),true);
    assert.deepEqual(await evaluate('Object.keys(__qa.store)'),[],'reading defaults never writes them');
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("select")).map(e=>e.id)'),['primary','secondary']);
    for (const id of ['primary','secondary']) {
      const offered = await evaluate('Array.from(document.getElementById(' + JSON.stringify(id) + ').options).map(o=>o.value).filter(Boolean).sort()');
      assert.deepEqual(offered,[...ids,'none'].sort());
    }
    for (const theme of ['light','dark']) {
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
      captures.push(await capture('settings-' + width + '-' + theme + '.png'));
      const layout=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,selects:document.querySelectorAll("select").length,targets:Array.from(document.querySelectorAll("button,select,summary")).filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent,height:e.getBoundingClientRect().height})),labelled:Array.from(document.querySelectorAll("select")).every(e=>document.querySelector("label[for="+e.id+"]")&&e.getAttribute("aria-describedby").split(/\\s+/).every(id=>document.getElementById(id))),background:getComputedStyle(document.body).backgroundColor})');
      assert.ok(layout.scrollWidth<=width); assert.equal(layout.selects,2);
      assert.ok(layout.targets.every(target=>target.height>=44)); assert.equal(layout.labelled,true);
      layouts.push({width,theme,...layout});
    }
  }
  checks.push('exactly two role selectors, all eight choices and None,320/360 light/dark,labels/descriptions,44px targets,no horizontal overflow,no writes on load');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
  await change('primary','hold-up');
  assert.equal(await evaluate('document.getElementById("secondary").value'),'hold-up');
  assert.equal(await evaluate('document.getElementById("save").disabled'),true);
  assert.equal(await evaluate('document.getElementById("status").textContent'),'Choose a different shortcut for each activity.');
  assert.equal(await evaluate('document.getElementById("shortcut-error").hidden'),false);
  assert.equal(await evaluate('document.getElementById("primary").getAttribute("aria-invalid")'),'true');
  assert.equal(await evaluate('document.getElementById("primary").getAttribute("aria-describedby").includes("shortcut-error")'),true);
  await evaluate('document.getElementById("save").click()');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'),0);
  captures.push(await capture('collision-320.png'));
  await change('secondary','hold-down');
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-up','resolving a collision preserves the other selection');
  await evaluate('__qa.faults.delay=200;document.getElementById("save").click()');
  assert.equal(await evaluate('document.getElementById("save").textContent'),'Saving…');
  assert.equal(await evaluate('document.getElementById("primary").disabled'),true);
  await evaluate('document.getElementById("save").click()');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'),1);
  await wait('document.getElementById("status").textContent==="Settings saved."');
  const stored=await evaluate('__qa.store');
  assert.deepEqual(JSON.parse(stored[key]),pair('hold-up','hold-down'));
  await send('Page.navigate',{url:fixture(stored)}); await wait('!document.getElementById("primary").disabled');
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-up');
  assert.equal(await evaluate('document.getElementById("secondary").value'),'hold-down');
  assert.equal(await evaluate('document.getElementById("save").disabled'),true);
  await change('primary','tap-up'); await evaluate('document.getElementById("discard").click()');
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-up');
  assert.equal(await evaluate('__qa.requests.some(m=>m.type==="saveSettings")'),false);
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="getSettings").length'),1);
  checks.push('same-shortcut collision blocks Save without clearing either role; swaps save; one pending save; cold reopen and local Discard retain confirmed choices');
  layoutWork = await evaluate(`(async()=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const actions=document.getElementById('actions'),original=actions.getBoundingClientRect;
    const result={resizeEvents:40,readsBeforeFrame:0,reads:0,writes:0};
    actions.getBoundingClientRect=function(){result.reads++;return original.call(this);};
    const observer=new MutationObserver(changes=>{result.writes+=changes.length;});
    observer.observe(actions,{attributes:true,attributeFilter:['data-flow']});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    for(let i=0;i<20;i++){
      window.dispatchEvent(new Event('resize'));
      window.visualViewport.dispatchEvent(new Event('resize'));
    }
    result.readsBeforeFrame=result.reads;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    observer.disconnect();actions.getBoundingClientRect=original;return result;
  })()`);
  assert.equal(layoutWork.readsBeforeFrame,0); assert.equal(layoutWork.reads,1); assert.equal(layoutWork.writes,0);
  checks.push('40 synchronous viewport resize notifications cause one deferred footer geometry read and no unchanged layout writes');
  for (const id of ids) {
    for (const role of ['primary','secondary']) {
      await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair('none','none'))})});
      await wait('!document.getElementById("primary").disabled');
      await change(role,id); await evaluate('document.getElementById("save").click()');
      await wait('document.getElementById("status").textContent==="Settings saved."');
      const seed=await evaluate('__qa.store'), expected=pair('none','none'); expected[role+'Shortcut']=id;
      assert.deepEqual(JSON.parse(seed[key]),expected);
      await send('Page.navigate',{url:fixture(seed)}); await wait('!document.getElementById("primary").disabled');
      assert.equal(await evaluate('document.getElementById('+JSON.stringify(role)+').value'),id);
      assert.equal(await evaluate('document.getElementById("save").disabled'),true);
      assert.equal(await evaluate('__qa.requests.some(m=>m.type==="saveSettings")'),false);
    }
  }
  checks.push('all eight shortcut choices save and cold-reopen independently for both roles; None disables the other role without a fallback');
  const old={version:1,defaultRole:'primary',holdOverrides:{up:'secondary',down:'primary',back:'secondary'},tapOverrides:{up:'secondary'}};
  const oldSeed={[key]:JSON.stringify(old)};
  await send('Page.navigate',{url:fixture(oldSeed)}); await wait('!document.getElementById("primary").disabled');
  assert.deepEqual(await evaluate('__qa.store'),oldSeed);
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-down');
  assert.equal(await evaluate('document.getElementById("secondary").value'),'hold-up');
  assert.equal(await evaluate('document.getElementById("status").textContent'),'Save to use these two shortcuts.');
  assert.equal(await evaluate('document.getElementById("save").disabled'),false);
  captures.push(await capture('migration-320.png'));
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="Settings saved."');
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
  checks.push('old mappings remain byte-identical on load; schema2 conversion uses explicit Save and keeps projected Primary/Secondary choices');
  await send('Page.navigate',{url:fixture(stored,{load:1})});
  await wait('!document.getElementById("retry").hidden');
  assert.equal(await evaluate('document.getElementById("save").disabled'),true);
  assert.equal(await evaluate('document.getElementById("primary").selectedOptions[0].textContent'),'Not loaded');
  captures.push(await capture('load-error-320.png'));
  await evaluate('document.getElementById("retry").click()'); await wait('!document.getElementById("primary").disabled');
  assert.deepEqual(await evaluate('__qa.store'),stored);
  await change('primary','combo-back-up'); await evaluate('__qa.faults.save=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  assert.equal(await evaluate('document.getElementById("primary").value'),'combo-back-up');
  assert.equal(await evaluate('document.getElementById("discard").textContent'),'Reload saved');
  assert.deepEqual(await evaluate('__qa.store'),stored);
  captures.push(await capture('save-error-320.png'));
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="Settings saved."');
  checks.push('failed loading shows unknown choices and Retry; failed Save keeps both role choices and retries explicitly');
  await change('primary','hold-select'); await evaluate('__qa.faults.ackLost=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  await change('primary','combo-back-up'); assert.equal(await evaluate('document.getElementById("save").disabled'),false);
  const writes=await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length');
  await evaluate('document.getElementById("discard").click()'); await wait('document.getElementById("status").textContent==="Saved settings reloaded."');
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-select');
  assert.equal(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").length'),writes);
  checks.push('a write with lost acknowledgement stays uncertain; explicit Reload saved reads the stored result without writing');
  await send('Page.navigate',{url:fixture({[key]:'{broken'})}); await wait('!document.getElementById("primary").disabled');
  assert.equal(await evaluate('__qa.store['+JSON.stringify(key)+']'),'{broken');
  assert.equal(await evaluate('document.getElementById("save").disabled'),false);
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="Settings saved."');
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
  await evaluate('document.querySelector(".help").open=true;document.querySelector(".help").scrollIntoView({block:"start"})');
  captures.push(await capture('setup-help-320.png'));
  checks.push('unreadable preferences require explicit repair Save; two selectors remain the entire configuration with setup disclosed separately');

  // Keyboard-size and zoom-equivalent viewports expose footer overlap that is
  // invisible in a tall screenshot. Native focus scrolling must keep fields
  // and action buttons reachable, without product code moving focus.
  const accessibility = [];
  for (const viewport of [{name:'short',width:320,height:360},{name:'zoom-200-equivalent',width:160,height:400}]) {
    await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:true});
    await send('Page.navigate',{url:fixture()}); await wait('!document.getElementById("primary").disabled');
    await wait('document.getElementById("actions").getAttribute("data-flow")==="true"');
    await evaluate('document.getElementById("secondary").focus()');
    const geometry=await evaluate('(()=>{const f=document.getElementById("secondary").getBoundingClientRect(),b=document.getElementById("actions").getBoundingClientRect();return {active:document.activeElement.id,field:{top:f.top,bottom:f.bottom},footer:{top:b.top,height:b.height,position:getComputedStyle(document.getElementById("actions")).position},viewport:innerHeight,scrollWidth:document.documentElement.scrollWidth,fieldCovered:f.bottom>b.top&&f.top<b.bottom};})()');
    assert.equal(geometry.active,'secondary'); assert.equal(geometry.footer.position,'static');
    assert.equal(geometry.fieldCovered,false); assert.ok(geometry.field.top>=0&&geometry.field.bottom<=viewport.height);
    assert.ok(geometry.scrollWidth<=viewport.width);
    captures.push(await capture('focus-' + viewport.name + '.png'));
    await change('primary','combo-back-up');
    await evaluate('document.getElementById("primary").focus()');
    for (let index=0; index<4; index++) {
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    }
    const action=await evaluate('(()=>{const f=document.getElementById("save").getBoundingClientRect();return {active:document.activeElement.id,top:f.top,bottom:f.bottom};})()');
    assert.equal(action.active,'save'); assert.ok(action.top>=0&&action.bottom<=viewport.height);
    accessibility.push({viewport,focusedSecondary:geometry,keyboardSave:action});
    captures.push(await capture('actions-' + viewport.name + '.png'));
  }
  checks.push('short320x360 and200%-zoom-equivalent160x400: focused Secondary and keyboard-reached Save are visible; action area returns to document flow; no horizontal overflow');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:fixture()}); await wait('!document.getElementById("primary").disabled');
  await evaluate('document.querySelectorAll("body,button,select,.status").forEach(e=>e.style.fontSize="32px")');
  await wait('parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--actions-height"))>=document.getElementById("actions").getBoundingClientRect().height||document.getElementById("actions").getAttribute("data-flow")==="true"');
  await evaluate('document.getElementById("secondary").focus()');
  const largeText=await evaluate('(()=>{const f=document.getElementById("secondary").getBoundingClientRect(),a=document.getElementById("actions").getBoundingClientRect();return {flow:document.getElementById("actions").getAttribute("data-flow"),height:a.height,scrollWidth:document.documentElement.scrollWidth,fieldTop:f.top,fieldBottom:f.bottom,covered:f.bottom>a.top&&f.top<a.bottom};})()');
  assert.equal(largeText.covered,false); assert.ok(largeText.fieldTop>=0&&largeText.fieldBottom<=800); assert.ok(largeText.scrollWidth<=320);
  captures.push(await capture('large-text-focus-320.png'));
  accessibility.push({largeText});
  await evaluate('document.querySelectorAll("body,button,select,.status").forEach(e=>e.style.fontSize="48px")');
  await wait('document.getElementById("actions").getAttribute("data-flow")==="true"');
  await evaluate('document.getElementById("primary").focus();document.getElementById("secondary").focus()');
  const oversizedText=await evaluate('(()=>{const f=document.getElementById("secondary").getBoundingClientRect(),a=document.getElementById("actions").getBoundingClientRect();return {flow:document.getElementById("actions").getAttribute("data-flow"),height:a.height,scrollWidth:document.documentElement.scrollWidth,fieldTop:f.top,fieldBottom:f.bottom,covered:f.bottom>a.top&&f.top<a.bottom};})()');
  assert.equal(oversizedText.flow,'true'); assert.equal(oversizedText.covered,false); assert.ok(oversizedText.scrollWidth<=320);
  captures.push(await capture('oversized-text-flow-320.png'));
  accessibility.push({oversizedText});
  checks.push('large text moves an oversized action area into document flow; selected shortcut names drive setup copy and disabled roles show no assignment');
  assert.deepEqual(errors, []);
  const report = {version, result: 'PASS', pbw: {file: path.basename(artifact), sha256: sha(fs.readFileSync(artifact))},
    executedPackagedFiles: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)])),
    captures, layouts, accessibility, layoutWork, checks, errors,
    scope: 'Actual packaged offline config HTML and config-only plugin in installed Chromium. Mock SDK bridge and isolated in-memory settings; no native lifetime, real phone WebView or physical-watch Quick Launch claim.'};
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  socket.close(); fs.rmSync(scratch, {recursive: true, force: true});
  console.log(JSON.stringify({result: 'PASS', output, captures: captures.length, checks}, null, 2));
}
run().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => {
  if (activeSocket) activeSocket.close();
  fs.rmSync(scratch, {recursive:true,force:true});
});
