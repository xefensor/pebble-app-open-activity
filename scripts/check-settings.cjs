'use strict';
// Actual packaged HTML/config handlers in Chromium; only the SDK bridge/storage
// are simulated. Requires an existing local Chromium debugging endpoint.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const artifact = path.resolve(process.env.PEBBLE_PBW || path.join(root, 'build/candidate/Open-Activity-' + version + '.pbw'));
const output = path.resolve(process.argv[2] || path.join(process.env.PEBBLE_QA_OUTPUT_ROOT || path.join(root, 'build/qa'), 'settings'));
const endpoint = process.env.OPEN_ACTIVITY_CHROMIUM_ENDPOINT || 'http://127.0.0.1:9229';
const files = JSON.parse(execFileSync('python3', ['-c',
  'import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z: print(json.dumps({n:z.read(n).decode() for n in ["config.html","plugin.js","pebble-js-app.js"]}))', artifact], {encoding: 'utf8'}));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const expectedSha = process.env.OPEN_ACTIVITY_EXPECTED_SHA256;
if (expectedSha) assert.equal(sha(fs.readFileSync(artifact)), expectedSha, 'Exact reviewed PBW required');
assert.equal(files['config.html'], fs.readFileSync(path.join(root, 'config.html'), 'utf8'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'open-activity-ux-'));
let activeSocket;
fs.mkdirSync(output, {recursive: true});
function simulatedSdk(seed, faults, pluginCode, pkjsCode, persistenceKey) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const previous=sessionStorage.getItem(persistenceKey);
  const state = window.__qa = {generation:Math.random().toString(36),store:previous?JSON.parse(previous):copy(seed), dom:null, requests:[], targetQueries:[], faults,
    active:false, forbidden:{appMessages:0,subscriptions:0,actions:0}};
  const persist=()=>sessionStorage.setItem(persistenceKey,JSON.stringify(state.store));
  let pluginHandler, events = {};
  const owns = (store, key) => Object.prototype.hasOwnProperty.call(store,key) ? store[key] : null;
  const nativeStorage = {getItem:key=>owns(state.store,key),setItem:(key,value)=>{state.store[key]=String(value);persist();}};
  const forbidden = name => () => {state.forbidden[name]++;throw Error('Settings must not start '+name);};
  new Function('Pebble','localStorage',pluginCode)({registerConfigHandler:fn=>{pluginHandler=fn;}},nativeStorage);
  state.startPkjs = function() {
    state.dom=copy(state.store); events={};
    const storage={getItem:key=>owns(state.dom,key),setItem:(key,value)=>{state.dom[key]=String(value);state.store[key]=String(value);persist();}};
    new Function('Pebble','localStorage',pkjsCode)({addEventListener:(name,fn)=>{events[name]=fn;},
      sendAppMessage:forbidden('appMessages'),subscribeToSource:forbidden('subscriptions'),invokeAction:forbidden('actions')},storage);
    // Do not dispatch ready/appmessage: settings must not begin a launch attempt.
    state.active=true;
  };
  state.teardownPkjs = function() {
    // Android WebViewJsRunner persists its complete restored DOM map on stop.
    state.store=copy(state.dom);state.active=false;events={};persist();
  };
  if(faults.active)state.startPkjs();
  window.Pebble={
    targets() {
      state.targetQueries.push(state.active);
      if(state.faults.targetsFail){state.faults.targetsFail--;return Promise.reject(Error('target discovery failed'));}
      return Promise.resolve(state.active?[{id:'plugin'},{id:'pkjs'}]:[{id:'plugin'}]);
    },
    addEventListener(name,fn) {
      if(name==='ready')document.addEventListener('DOMContentLoaded',()=>{fn({target:'plugin'});if(state.active)fn({target:'pkjs'});});
    },
    sendMessage(target,message) {
      if(target!=='plugin'&&target!=='pkjs')throw Error('Unexpected target');
      state.requests.push(Object.assign({target},copy(message)));
      return new Promise((resolve,reject)=>{
        if(message.type==='getSettings'&&state.faults.load){state.faults.load--;reject(Error('load'));return;}
        if(message.type==='saveSettings'&&state.faults.reject){state.faults.reject--;resolve({ok:false,rejected:true});return;}
        if(message.type==='saveSettings'&&state.faults.save){state.faults.save--;resolve({ok:false});return;}
        if(message.type==='saveSettings'&&target==='pkjs'&&state.faults.pkjsReject){
          state.faults.pkjsReject--;if(state.faults.goneOnFailure)state.teardownPkjs();
          reject(Error('PKJS transport failed'));return;
        }
        if(message.type==='saveSettings'&&state.faults.mismatchedAck){
          state.faults.mismatchedAck--;resolve({ok:true,settings:{version:2,primaryShortcut:'none',secondaryShortcut:'none'}});return;
        }
        const dispatch=respond=>{
          if(target==='plugin')pluginHandler(message,response=>{
            if(message.type==='saveSettings'&&state.faults.appearAfterPluginSave){state.faults.appearAfterPluginSave--;state.startPkjs();}
            respond(response);
          });
          else if(state.active&&events.configmessage)events.configmessage({data:message,respond});
          else reject(Error('No live PKJS settings handler'));
        };
        if(message.type==='saveSettings'&&state.faults.ackLost){state.faults.ackLost--;dispatch(()=>reject(Error('lost acknowledgement')));return;}
        setTimeout(()=>dispatch(resolve),state.faults.delay||0);
      });
    }
  };
}
function fixture(seed = {}, faults = {}) {
  const args=[seed,faults,files['plugin.js'],files['pebble-js-app.js'],'oa-settings-'+crypto.randomBytes(8).toString('hex')].map(value=>JSON.stringify(value).replace(/<\/script/gi,'<\\/script'));
  const shim='<script>('+simulatedSdk.toString()+')('+args.join(',')+');</script>';
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
  const englishLocale=await send('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"language",{configurable:true,get:()=>"en-US"});'});
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
    assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("select")).map(e=>e.id)'),['primary','secondary','watch-theme']);
    for (const id of ['primary','secondary']) {
      const offered = await evaluate('Array.from(document.getElementById(' + JSON.stringify(id) + ').options).map(o=>o.value).filter(Boolean).sort()');
      assert.deepEqual(offered,[...ids,'none'].sort());
    }
    for (const theme of ['light','dark']) {
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
      captures.push(await capture('settings-' + width + '-' + theme + '.png'));
      const layout=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,selects:document.querySelectorAll("select").length,targets:Array.from(document.querySelectorAll("button,select,summary")).filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent,height:e.getBoundingClientRect().height})),labelled:Array.from(document.querySelectorAll("select")).every(e=>document.querySelector("label[for="+e.id+"]")&&e.getAttribute("aria-describedby").split(/\\s+/).every(id=>document.getElementById(id))),background:getComputedStyle(document.body).backgroundColor})');
      assert.ok(layout.scrollWidth<=width); assert.equal(layout.selects,3);
      assert.ok(layout.targets.every(target=>target.height>=44)); assert.equal(layout.labelled,true);
      layouts.push({width,theme,...layout});
    }
  }
  checks.push('exactly two role selectors plus separate appearance, all eight shortcuts and None,320/360 light/dark,labels/descriptions,44px targets,no horizontal overflow,no writes on load');
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
  await wait('document.getElementById("status").textContent==="✓ Saved"');
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
      await wait('document.getElementById("status").textContent==="✓ Saved"');
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
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="✓ Saved"');
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
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="✓ Saved"');
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
  await evaluate('document.getElementById("save").click()'); await wait('document.getElementById("status").textContent==="✓ Saved"');
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
  await evaluate('document.querySelector(".help").open=true;document.querySelector(".help").scrollIntoView({block:"start"})');
  captures.push(await capture('setup-help-320.png'));
  checks.push('unreadable preferences require explicit repair Save; two shortcut selectors plus separate watch appearance; setup stays disclosed');

  const storageCases=[];
  const assertNoLaunchWork=async()=>assert.deepEqual(await evaluate('__qa.forbidden'),{appMessages:0,subscriptions:0,actions:0});
  const focusState=()=>evaluate('({tag:document.activeElement.tagName,id:document.activeElement.id})');
  for(const active of [false,true]) {
    const route=active?'pkjs':'plugin',chosen=pair('tap-up','combo-up-down');
    await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{active})});
    await wait('!document.getElementById("primary").disabled');
    assert.deepEqual(await focusState(),{tag:'BODY',id:''},'loading must not choose focus');
    await change('primary',chosen.primaryShortcut);await change('secondary',chosen.secondaryShortcut);
    await evaluate('document.getElementById("save").click()');
    await wait('document.getElementById("status").textContent==="✓ Saved"');
    const requests=await evaluate('__qa.requests.filter(m=>m.type==="saveSettings")');
    assert.deepEqual(requests.map(request=>request.target),[route]);
    assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),chosen);
    if(active) {
      assert.deepEqual(JSON.parse(await evaluate('__qa.dom['+JSON.stringify(key)+']')),chosen,'PKJS must update its own restored DOM snapshot');
      await evaluate('__qa.teardownPkjs()');
      assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),chosen,'SDK teardown must not overwrite confirmed choices');
    }
    await assertNoLaunchWork();
    const previousGeneration=await evaluate('__qa.generation');
    await send('Page.reload',{ignoreCache:true});
    await wait('window.__qa&&__qa.generation!=='+JSON.stringify(previousGeneration)+'&&!!document.getElementById("primary")');
    await wait('!document.getElementById("primary").disabled');
    assert.equal(await evaluate('document.getElementById("primary").value'),chosen.primaryShortcut);
    assert.equal(await evaluate('document.getElementById("secondary").value'),chosen.secondaryShortcut);
    assert.equal(await evaluate('document.getElementById("save").disabled'),true);
    assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings")'),[],'reopening only reads confirmed preferences');
    const focus=await focusState();assert.deepEqual(focus,{tag:'BODY',id:''},'full reopen must not choose focus');
    await assertNoLaunchWork();
    storageCases.push({route,fullPageReload:true,androidSeparateStores:true,pkjsTeardown:active,settings:chosen,focus});
    if(active)captures.push(await capture('settings-live-save-reopened-320.png'));
  }
  checks.push('closed plugin and active packaged PKJS save the exact two choices; separate Android DOM/native stores survive SDK teardown and full Page.reload with no autofocus or launch work');

  await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{active:true,pkjsReject:1})});
  await wait('!document.getElementById("primary").disabled');await change('primary','hold-select');
  await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").map(m=>m.target)'),['pkjs']);
  assert.ok(await evaluate('__qa.targetQueries.length>=2'),'failed live transport must recheck current targets');
  assert.equal(await evaluate('__qa.active'),true);
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
  assert.equal(await evaluate('document.getElementById("primary").value'),'hold-select');
  assert.equal(await evaluate('document.getElementById("save").disabled'),false);
  await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Saved"');
  assert.deepEqual(JSON.parse(await evaluate('__qa.dom['+JSON.stringify(key)+']')),pair('hold-select'));
  await assertNoLaunchWork();
  checks.push('still-live PKJS transport failure rechecks targets, never writes through the plugin, retains the draft and supports an explicit successful retry');

  await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{active:true,pkjsReject:1,goneOnFailure:true})});
  await wait('!document.getElementById("primary").disabled');await change('primary','hold-select');
  await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Saved"');
  assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").map(m=>m.target)'),['pkjs','plugin']);
  assert.equal(await evaluate('__qa.active'),false);
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair('hold-select'));
  await assertNoLaunchWork();
  checks.push('plugin fallback occurs only after fresh target discovery confirms PKJS has exited and its old DOM has been persisted');

  for(const active of [false,true]) {
    await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{active,mismatchedAck:1})});
    await wait('!document.getElementById("primary").disabled');await change('primary','hold-select');
    await evaluate('document.getElementById("save").click()');
    await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
    assert.equal(await evaluate('document.getElementById("primary").value'),'hold-select');
    assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
    assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").map(m=>m.target)'),[active?'pkjs':'plugin']);
    await assertNoLaunchWork();
  }
  checks.push('an ok acknowledgement containing different choices is unconfirmed on both routes and never triggers an alternate write');

  await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{active:true})});
  await wait('!document.getElementById("primary").disabled');await change('primary','hold-select');
  await evaluate('__qa.faults.targetsFail=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent.indexOf("not confirmed")>=0');
  assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings")'),[]);
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair());
  await assertNoLaunchWork();
  checks.push('failed current-target discovery preserves the draft without dispatching a save to an assumed destination');

  await send('Page.navigate',{url:fixture({[key]:JSON.stringify(pair())},{appearAfterPluginSave:1})});
  await wait('!document.getElementById("primary").disabled');await change('primary','hold-select');
  await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Saved"');
  assert.deepEqual(await evaluate('__qa.requests.filter(m=>m.type==="saveSettings").map(m=>m.target)'),['plugin','pkjs']);
  assert.deepEqual(JSON.parse(await evaluate('__qa.dom['+JSON.stringify(key)+']')),pair('hold-select'));
  await evaluate('__qa.teardownPkjs()');
  assert.deepEqual(JSON.parse(await evaluate('__qa.store['+JSON.stringify(key)+']')),pair('hold-select'));
  await assertNoLaunchWork();
  checks.push('PKJS appearing during a plugin save receives the exact confirmed choices before success, so its later teardown preserves them');

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
    for (let index=0; index<5; index++) {
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
  // New appearance is independent of shortcut routing, and actual packaged
  // handlers must persist it through close/reopen and active Android teardown.
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:fixture()}); await wait('!document.getElementById("watch-theme").disabled');
  const initialFocus=await evaluate('document.activeElement.id');
  await change('watch-theme','dark'); await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Saved"');
  assert.equal(await evaluate('document.activeElement.id'),initialFocus);
  assert.equal(await evaluate('document.getElementById("save").disabled'),true);
  assert.equal(await evaluate('document.getElementById("watch-theme").value'),'dark');
  await change('primary','tap-down'); await evaluate('__qa.faults.reject=1;document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="Couldn’t save. Try again."');
  assert.equal(await evaluate('document.getElementById("primary").value'),'tap-down');
  assert.equal(await evaluate('document.getElementById("discard").textContent'),'Discard');
  await evaluate('document.getElementById("save").click()');await wait('document.getElementById("status").textContent==="✓ Saved"');
  const appearanceStore=await evaluate('__qa.store');
  assert.equal(JSON.parse(appearanceStore['open-activity-ui-v1']).theme,'dark');
  captures.push(await capture('appearance-saved-360.png'));
  await send('Page.navigate',{url:fixture(appearanceStore,{active:true})});
  await wait('!document.getElementById("watch-theme").disabled');
  assert.equal(await evaluate('document.getElementById("watch-theme").value'),'dark');
  await change('watch-theme','light'); await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Saved"');
  await evaluate('__qa.teardownPkjs()');
  assert.equal(JSON.parse(await evaluate('__qa.store["open-activity-ui-v1"]')).theme,'light');
  await assertNoLaunchWork();
  checks.push('separate appearance persists through confirmed stay-open Save, cold reopen and active-writer Android teardown without moving focus');

  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:englishLocale.identifier});
  const localeScript=await send('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"language",{get:()=>"cs-CZ"});'});
  await send('Page.navigate',{url:fixture()});await wait('!document.getElementById("primary").disabled');
  assert.equal(await evaluate('document.documentElement.lang'),'cs');
  assert.equal(await evaluate('document.getElementById("shortcuts-heading").textContent'),'Zkratky aktivit');
  assert.equal(await evaluate('document.querySelector("label[for=primary]").textContent'),'Hlavní aktivita');
  await change('watch-theme','dark');await evaluate('document.getElementById("save").click()');
  await wait('document.getElementById("status").textContent==="✓ Uloženo"');
  assert.ok((await evaluate('document.getElementById("assignment-help").textContent')).startsWith('V nastavení'));
  captures.push(await capture('settings-cs-360-light.png'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  captures.push(await capture('settings-cs-360-dark.png'));
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:localeScript.identifier});
  checks.push('English and Czech actual phone interface labels, help, shortcut descriptions and persistent Save feedback render in light/dark');
  assert.deepEqual(errors, []);
  const report = {version, result: 'PASS', pbw: {file: path.basename(artifact), sha256: sha(fs.readFileSync(artifact))},
    executedPackagedFiles: Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)])),
    captures, layouts, accessibility, layoutWork, storageCases, checks, errors,
    scope: 'Actual packaged offline config HTML, config plugin and PKJS configmessage handler in installed Chromium. Mock SDK bridge, separate modeled Android DOM/native preference stores and simulated SDK teardown; no PKJS ready/appmessage dispatch, native lifetime, live phone WebView or physical-watch Quick Launch claim.'};
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  socket.close(); fs.rmSync(scratch, {recursive: true, force: true});
  console.log(JSON.stringify({result: 'PASS', output, captures: captures.length, checks}, null, 2));
}
run().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => {
  if (activeSocket) activeSocket.close();
  fs.rmSync(scratch, {recursive:true,force:true});
});
