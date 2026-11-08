'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const prefs=require('../src/pkjs/ui-preferences'),legacy=require('../src/pkjs/ui-settings');
const light={version:2,textSize:'follow',appearance:'light',lastExplicit:'light'};
const large={version:2,textSize:'large',appearance:'dark',lastExplicit:'dark'};
function setup(map=new Map(),transport=true){
 const sent=[],timers=new Map();let id=0,failWrite=false;
 const storage={getItem:key=>map.get(key)??null,setItem(key,value){if(failWrite)throw Error('disk');map.set(key,value);}};
 const controller=prefs.create({storage,send:transport?(message,fail,ok)=>sent.push({message,fail,ok}):undefined,later(fn){timers.set(++id,fn);return id;},cancel(id){timers.delete(id);}});
 return {controller,map,sent,timers,fail(value){failWrite=value;},request(type,settings){let result;controller.handle({type,settings},value=>result=value);return result;},ack(index=sent.length-1,edit){const bytes=sent[index].message.OA_UI_PREFERENCES.slice();if(edit)edit(bytes);return controller.receive(bytes);},tick(){const entry=timers.entries().next().value;assert.ok(entry);timers.delete(entry[0]);entry[1]();}};
}
test('phone save survives reopen; only exact persisted watch receipt marks applied',()=>{
 const offline=setup(new Map(),false),saved=offline.request('saveUiPreferences',large);
 assert.equal(saved.saved,true);assert.equal(saved.delivery.pending,true);assert.equal(offline.sent.length,0);
 const live=setup(offline.map);assert.deepEqual(live.request('getUiPreferences').settings,large);
 live.controller.reconcile(true);assert.equal(live.sent.length,1);
 live.sent[0].ok();assert.equal(live.request('getUiPreferences').delivery.applied,false);
 live.ack(0,b=>b[4]++);assert.equal(live.request('getUiPreferences').delivery.applied,false);
 live.ack(0,b=>b[8]=1);assert.equal(live.request('getUiPreferences').delivery.applied,false);
 assert.equal(live.ack(),true);assert.equal(live.timers.size,0);
 assert.equal(setup(live.map,false).request('getUiPreferences').delivery.applied,true);
});
test('new choices supersede old acknowledgments and retry at most three times',()=>{
 const s=setup();s.request('saveUiPreferences',light);const old=s.sent[0].message.OA_UI_PREFERENCES;
 s.request('saveUiPreferences',large);s.controller.receive(old);
 assert.equal(s.request('getUiPreferences').delivery.applied,false);
 s.sent[1].fail();s.tick();s.sent[2].ok();s.tick();s.tick();s.sent[3].fail();
 assert.equal(s.sent.length,4);assert.equal(s.timers.size,0);
 assert.equal(s.request('getUiPreferences').delivery.pending,true);
 s.request('retryUiPreferences');assert.equal(s.sent.length,5);
});
test('fresh watch state invalidates an earlier receipt even if pending metadata cannot be written',()=>{
 const s=setup();s.request('saveUiPreferences',large);s.ack();s.fail(true);
 const hello=prefs.encode(light,0);hello[3]=1;s.controller.receive(hello);
 assert.equal(s.request('getUiPreferences').delivery.applied,false);
 assert.equal(s.sent.length,2);s.fail(false);s.ack();
 assert.equal(s.request('getUiPreferences').delivery.applied,true);
});
test('save failure cannot become applied; retry and reopening retain desired choices',()=>{
 const s=setup();s.request('saveUiPreferences',large);s.ack(0,b=>b[2]=1);
 assert.equal(s.request('getUiPreferences').delivery.error,'watch_save_unconfirmed');
 assert.equal(setup(s.map,false).request('getUiPreferences').delivery.pending,true);
 s.request('retryUiPreferences');s.ack();assert.equal(s.request('getUiPreferences').delivery.applied,true);
});
test('explicit legacy migration keeps manual text and Follow appearance keeps its fallback',()=>{
 const map=new Map([[legacy.key,JSON.stringify({version:1,theme:'dark'})]]),s=setup(map);
 assert.deepEqual(s.request('getUiPreferences').settings,{...light,appearance:'dark',lastExplicit:'dark'});
 s.request('saveUiPreferences',{...large,appearance:'follow'});s.ack();
 assert.equal(s.request('getUiPreferences').settings.appearance,'follow');
 legacy.save({setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)},{version:1,theme:'light'});
 assert.deepEqual(s.request('getUiPreferences').settings,{...large,appearance:'light',lastExplicit:'light'});
 s.controller.reconcile(true);s.ack();
 assert.deepEqual(s.request('getUiPreferences').settings,{...large,appearance:'light',lastExplicit:'light'});
});
test('corrupt phone store requires explicit repair; invalid choices and unconfirmed writes fail closed',()=>{
 const s=setup(new Map([[prefs.key,'broken']]));
 assert.equal(s.request('getUiPreferences').needsRepair,true);assert.equal(s.controller.reconcile(true),false);
 assert.equal(s.map.get(prefs.key),'broken');
 assert.equal(s.request('saveUiPreferences',{...large,extra:true}).ok,false);
 s.fail(true);assert.equal(s.request('saveUiPreferences',large).ok,false);assert.equal(s.sent.length,0);
 s.fail(false);assert.equal(s.request('saveUiPreferences',large).saved,true);
});
test('wire codec rejects malformed lengths, flags, enum and manual fallback inconsistencies',()=>{
 const bytes=prefs.encode(large,0xfedcba98);assert.equal(prefs.decode(bytes).revision,0xfedcba98);
 for(const mutate of [b=>b.pop(),b=>b[1]=2,b=>b[2]=2,b=>b[3]=2,b=>b[8]=4,b=>b[16]=1,b=>b[9]=256]){
  const invalid=bytes.slice();mutate(invalid);assert.equal(prefs.decode(invalid),null);
 }
});

test('editing an uncommitted legacy migration keeps advancing the known revision',()=>{
 const s=setup();s.request('saveUiPreferences',large);s.ack();
 const revision=JSON.parse(s.map.get(prefs.key)).revision;
 s.map.set(legacy.key,JSON.stringify({version:1,theme:'light'}));
 const edited={...large,textSize:'small'};s.request('saveUiPreferences',edited);
 assert.ok(JSON.parse(s.map.get(prefs.key)).revision>revision);
});

const createLauncher=require('../src/pkjs/launcher'),protocol=require('../src/pkjs/protocol'),shortcuts=require('../src/pkjs/settings');
function host(){
 const map=new Map([[shortcuts.key,JSON.stringify(shortcuts.defaults())]]),sent=[],timers=new Map(),subscriptions=[],invocations=[];let id=0;
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const launcher=createLauncher({storage,now:()=>1800000000000,later(fn){timers.set(++id,fn);return id;},cancelLater:id=>timers.delete(id),pebble:{sendAppMessage(message,ok){sent.push(message);ok();},subscribeToSource(request){subscriptions.push(request);return {unsubscribe(){}};},invokeAction(value){invocations.push(value);return Promise.resolve({ok:true});}}});
 return {map,sent,timers,subscriptions,invocations,launcher};
}
test('preference delivery waits for passive setup proof and an exact native receipt',()=>{
 const h=host(),before=h.map.get(shortcuts.key);
 assert.equal(h.launcher.preferences({type:'saveUiPreferences',settings:large}).delivery.pending,true);
 assert.equal(h.sent.length,0);assert.equal(h.timers.size,0);h.launcher.ready();assert.equal(h.sent.length,1);
 const hello=prefs.encode(light,0);hello[3]=1;h.launcher.message({OA_UI_PREFERENCES_RESULT:hello});
 assert.equal(h.sent.length,2);const frame=h.sent[1].OA_UI_PREFERENCES;
 assert.equal(h.launcher.preferences({type:'getUiPreferences'}).delivery.applied,false);
 h.launcher.message({OA_UI_PREFERENCES_RESULT:frame});
 assert.equal(h.launcher.preferences({type:'getUiPreferences'}).delivery.applied,true);
 assert.equal(h.timers.size,0);assert.equal(h.subscriptions.length,0);assert.equal(h.invocations.length,0);
 assert.equal(h.map.get(shortcuts.key),before);
});
test('Quick Launch defers display changes and keeps one original budget and one provider',()=>{
 const h=host();h.launcher.preferences({type:'saveUiPreferences',settings:large});h.launcher.ready();
 h.launcher.message(protocol.message(protocol.operation.HELLO,{OA_SESSION:9,OA_BUTTON:3,OA_GESTURE:1,OA_ELAPSED_MS:100}));
 assert.equal(h.launcher.state(),'resolving');assert.equal(h.subscriptions.length,1);assert.equal(h.timers.size,1);
 const messages=h.sent.length;h.launcher.preferences({type:'saveUiPreferences',settings:light});
 const hello=prefs.encode(light,0);hello[3]=1;h.launcher.message({OA_UI_PREFERENCES_RESULT:hello});
 assert.equal(h.sent.length,messages);assert.equal(h.timers.size,1);assert.equal(h.invocations.length,0);
 h.launcher.cancel();assert.equal(h.timers.size,0);
});
