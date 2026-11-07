#include <assert.h>
#include <stdio.h>
#include <pebble.h>

#define main helper_app_main
#include "../src/c/main.c"
#undef main

static AppLaunchReason reason;
static AppQuickLaunchAction gesture;
static ButtonId button;
static bool connected;
static uint32_t clock_ms;
static int created, pushed, popped, loops, sent;
static int gesture_reads, button_reads, message_opens, message_handlers, outbox_begins;
static int connection_subscribes, connection_unsubscribes, connection_peeks, message_deregisters;
static int timer_registers, click_providers, default_backs;
static int text_creates, text_destroys, window_destroys, status_creates, status_destroys;
static int fail_text_at;
static bool fail_window, fail_status;
static int32_t stored_theme;
static int theme_writes,clock_subscribes,clock_unsubscribes,font_loads,font_unloads;
static bool theme_write_fails;
static GColor window_background;
static AppMessageResult opening_result;
static DictionaryIterator outgoing;
static AppTimer timer;
static Window window;
static TextLayer labels[4];
static const char *label_text[4];
static bool label_destroyed[4];
static StatusBarLayer status_bar;
static Layer layer;
static void (*loop_script)(void);
static void (*back_click)(ClickRecognizerRef,void *);

AppLaunchReason launch_reason(void) {return reason;}
AppQuickLaunchAction launch_get_quick_launch_action(void) {gesture_reads++;return gesture;}
ButtonId launch_button(void) {button_reads++;return button;}
uint16_t time_ms(time_t *seconds,uint16_t *milliseconds) {*seconds=clock_ms/1000;*milliseconds=clock_ms%1000;return *milliseconds;}
Tuple *dict_find(DictionaryIterator *dict,uint32_t key) {
  for (size_t i=0;i<dict->count;++i) if(dict->tuples[i].key==key)return &dict->tuples[i];
  return NULL;
}
static Tuple *add(DictionaryIterator *dict,uint32_t key,uint8_t type,uint16_t length) {
  assert(dict->count<8);size_t i=dict->count++;
  dict->tuples[i]=(Tuple){key,type,length,&dict->values[i]};
  memset(&dict->values[i],0,sizeof(dict->values[i]));return &dict->tuples[i];
}
void dict_write_uint8(DictionaryIterator *dict,uint32_t key,uint8_t value) {add(dict,key,TUPLE_UINT,1)->value->uint8=value;}
void dict_write_uint32(DictionaryIterator *dict,uint32_t key,uint32_t value) {add(dict,key,TUPLE_UINT,4)->value->uint32=value;}
void dict_write_cstring(DictionaryIterator *dict,uint32_t key,const char *value) {strcpy(add(dict,key,TUPLE_CSTRING,(uint16_t)(strlen(value)+1))->value->cstring,value);}
AppMessageResult app_message_outbox_begin(DictionaryIterator **value) {outbox_begins++;outgoing.count=0;*value=&outgoing;return APP_MSG_OK;}
AppMessageResult app_message_outbox_send(void) {sent++;return APP_MSG_OK;}
AppMessageResult app_message_open(uint32_t in,uint32_t out) {message_opens++;assert(in==192&&out==192);return opening_result;}
void app_message_register_inbox_received(void (*fn)(DictionaryIterator *,void *)) {assert(fn);message_handlers++;}
void app_message_register_outbox_sent(void (*fn)(DictionaryIterator *,void *)) {assert(fn);message_handlers++;}
void app_message_register_outbox_failed(void (*fn)(DictionaryIterator *,AppMessageResult,void *)) {assert(fn);message_handlers++;}
void app_message_deregister_callbacks(void) {message_deregisters++;}
AppTimer *app_timer_register(uint32_t delay,void (*callback)(void *),void *ctx) {(void)ctx;timer_registers++;timer=(AppTimer){true,delay,callback};return &timer;}
void app_timer_cancel(AppTimer *value) {value->active=false;}
void window_stack_pop_all(bool animated) {assert(!animated);popped++;}
static void default_back(ClickRecognizerRef recognizer,void *context) {(void)recognizer;(void)context;default_backs++;window_stack_pop_all(false);}
void window_stack_push(Window *value,bool animated) {(void)value;assert(!animated);pushed++;if(!back_click)back_click=default_back;}
void window_single_click_subscribe(ButtonId value,void (*fn)(ClickRecognizerRef,void *)) {assert(value==BUTTON_ID_BACK);back_click=fn;}
Window *window_create(void) {created++;return fail_window?NULL:&window;}
void window_set_background_color(Window *value,GColor color) {(void)value;window_background=color;}
void window_set_click_config_provider(Window *value,void (*fn)(void *)) {(void)value;click_providers++;fn(NULL);}
Layer *window_get_root_layer(Window *value) {(void)value;return &layer;}
GRect layer_get_bounds(Layer *value) {(void)value;return GRect(0,0,200,228);}
TextLayer *text_layer_create(GRect rect) {
  assert(rect.origin.x>=0&&rect.origin.x+rect.size.w<=200&&rect.origin.y>=0&&rect.origin.y+rect.size.h<=228);
  assert(text_creates<4);int at=text_creates++;
  return fail_text_at==at+1?NULL:&labels[at];
}
void text_layer_set_text(TextLayer *value,const char *text) {assert(value>=labels&&value<labels+4);label_text[value-labels]=text;}
void text_layer_set_font(TextLayer *value,GFont font) {(void)value;(void)font;}
void text_layer_set_text_alignment(TextLayer *value,int alignment) {(void)value;(void)alignment;}
void text_layer_set_text_color(TextLayer *value,GColor color) {(void)value;(void)color;}
void text_layer_set_background_color(TextLayer *value,GColor color) {(void)value;(void)color;}
GFont fonts_get_system_font(const char *key) {return key;}
GFont fonts_load_custom_font(unsigned handle) {font_loads++;return (GFont)(uintptr_t)handle;}
void fonts_unload_custom_font(GFont font) {assert(font);font_unloads++;}
unsigned resource_get_handle(unsigned handle) {return handle;}
bool persist_exists(unsigned key) {assert(key==OA_THEME_STORAGE_KEY);return stored_theme>=0;}
int32_t persist_read_int(unsigned key) {assert(key==OA_THEME_STORAGE_KEY);return stored_theme;}
int persist_write_int(unsigned key,int32_t value) {assert(key==OA_THEME_STORAGE_KEY);theme_writes++;if(theme_write_fails)return -1;stored_theme=value;return sizeof(int32_t);}
bool clock_is_24h_style(void) {return true;}
void tick_timer_service_subscribe(TimeUnits units,void (*handler)(struct tm *,TimeUnits)) {assert(units==MINUTE_UNIT&&handler);clock_subscribes++;}
void tick_timer_service_unsubscribe(void) {clock_unsubscribes++;}
Layer *text_layer_get_layer(TextLayer *value) {(void)value;return &layer;}
void layer_add_child(Layer *parent,Layer *child) {(void)parent;(void)child;}
void text_layer_destroy(TextLayer *value) {
  assert(value>=labels&&value<labels+4);size_t at=(size_t)(value-labels);
  assert(!label_destroyed[at]);label_destroyed[at]=true;text_destroys++;
}
StatusBarLayer *status_bar_layer_create(void) {status_creates++;return fail_status?NULL:&status_bar;}
void status_bar_layer_set_colors(StatusBarLayer *value,GColor background,GColor foreground) {assert(value==&status_bar&&background==GColorWhite&&foreground==GColorBlack);}
Layer *status_bar_layer_get_layer(StatusBarLayer *value) {assert(value==&status_bar);return &layer;}
void status_bar_layer_destroy(StatusBarLayer *value) {assert(value==&status_bar);status_destroys++;assert(status_destroys==1);}
void window_destroy(Window *value) {assert(value==&window);window_destroys++;assert(window_destroys==1);}
void connection_service_subscribe(ConnectionHandlers handlers) {assert(handlers.pebble_app_connection_handler);connection_subscribes++;}
void connection_service_unsubscribe(void) {connection_unsubscribes++;}
bool connection_service_peek_pebble_app_connection(void) {connection_peeks++;return connected;}
void app_event_loop(void) {loops++;if(loop_script)loop_script();}

static void reset(void) {
  reason=APP_LAUNCH_QUICK_LAUNCH;gesture=APP_QUICK_LAUNCH_ACTION_HOLD;
  button=BUTTON_ID_DOWN;connected=true;clock_ms=1000;
  created=pushed=popped=loops=sent=0;opening_result=APP_MSG_OK;
  gesture_reads=button_reads=message_opens=message_handlers=outbox_begins=0;
  connection_subscribes=connection_unsubscribes=connection_peeks=message_deregisters=0;
  timer_registers=click_providers=default_backs=0;
  text_creates=text_destroys=window_destroys=status_creates=status_destroys=0;
  fail_text_at=0;fail_window=fail_status=false;
  stored_theme=-1;theme_writes=clock_subscribes=clock_unsubscribes=font_loads=font_unloads=0;theme_write_fails=false;window_background=GColorClear;
  memset(label_text,0,sizeof(label_text));memset(label_destroyed,0,sizeof(label_destroyed));
  s_window=NULL;s_label=NULL;s_timeout=NULL;s_sending=false;s_pending_operation=0;
  s_setup_body=NULL;s_setup_hint=NULL;s_clock=NULL;s_setup_mode=false;
  s_dark=false;s_message_opened=false;s_clock_subscribed=false;
  memset(&s_attempt,0,sizeof(s_attempt));memset(&timer,0,sizeof(timer));
  loop_script=NULL;back_click=NULL;
}
static void request(void) {
  DictionaryIterator input={0};dict_write_uint8(&input,OA_KEY_OPERATION,OA_REQUEST);
  inbox_received(&input,NULL);
}
static void prepare(uint32_t session,bool malformed) {
  DictionaryIterator input={0};dict_write_uint8(&input,OA_KEY_OPERATION,OA_PREPARE);
  dict_write_uint32(&input,OA_KEY_SESSION,session);
  dict_write_uint32(&input,OA_KEY_TICKET,777);
  dict_write_uint8(&input,OA_KEY_ROLE,OA_SECONDARY);
  dict_write_cstring(&input,OA_KEY_DESTINATION,"1f03293d-47af-4f28-b960-f2b02a6dd757");
  if(malformed)dict_find(&input,OA_KEY_DESTINATION)->length=1;
  inbox_received(&input,NULL);
}
static void handshake_script(void) {
  assert(timer.active&&timer.delay==4000);
  request();assert(sent==1);
  assert(dict_find(&outgoing,OA_KEY_OPERATION)->value->uint8==OA_HELLO);
  assert(dict_find(&outgoing,OA_KEY_BUTTON)->value->uint8==BUTTON_ID_UP);
  assert(dict_find(&outgoing,OA_KEY_GESTURE)->value->uint8==APP_QUICK_LAUNCH_ACTION_HOLD);
  outbox_sent(NULL,NULL);
  uint32_t session=s_attempt.session;
  assert(session>0&&session<=INT32_MAX);
  prepare(session+1,false);assert(sent==1);
  prepare(session,false);assert(sent==2&&s_attempt.phase==OA_CONFIRMED);
  assert(dict_find(&outgoing,OA_KEY_OPERATION)->value->uint8==OA_CONFIRM);
  assert(dict_find(&outgoing,OA_KEY_TICKET)->value->uint32==777);
  assert(dict_find(&outgoing,OA_KEY_ROLE)->value->uint8==OA_SECONDARY);
  assert(strcmp(dict_find(&outgoing,OA_KEY_DESTINATION)->value->cstring,"1f03293d-47af-4f28-b960-f2b02a6dd757")==0);
  outbox_sent(NULL,NULL);prepare(session,false);assert(sent==2);
  clock_ms+=4000;timer.callback(NULL);assert(popped==1&&s_attempt.phase==OA_CLOSED);
}
static void back_script(void) {assert(back_click);back_click(NULL,NULL);assert(popped==1&&s_attempt.phase==OA_CLOSED);}
static void malformed_script(void) {prepare(s_attempt.session,true);assert(popped==1&&s_attempt.phase==OA_CLOSED);}
static void slot_script(void) {
  request();assert(sent==1);
  assert(dict_find(&outgoing,OA_KEY_BUTTON)->value->uint8==button);
  assert(dict_find(&outgoing,OA_KEY_GESTURE)->value->uint8==gesture);
  outbox_sent(NULL,NULL);prepare(s_attempt.session,false);
  assert(sent==2&&s_attempt.phase==OA_CONFIRMED);
  outbox_sent(NULL,NULL);prepare(s_attempt.session,false);assert(sent==2);
  back_script();
}
static void no_setup_work(void) {
  assert(gesture_reads==0&&button_reads==0);
  assert(message_opens<=1&&message_handlers<=1&&outbox_begins==0&&sent==0);
  assert(connection_subscribes==0&&connection_unsubscribes==0&&connection_peeks==0);
  assert(timer_registers==0&&!timer.active&&s_timeout==NULL);
  assert(s_attempt.phase==OA_CLOSED&&s_attempt.session==0&&s_attempt.started_ms==0&&s_attempt.ticket==0&&!s_attempt.destination[0]);
}
static void setup_script(void) {
  assert(s_setup_mode&&pushed==1&&click_providers==0&&back_click);
  assert(status_creates==0&&text_creates==4&&clock_subscribes==1&&message_opens==1&&message_handlers==1);
  assert(!strcmp(label_text[0],"Open Activity"));
  assert(!strcmp(label_text[2],"Open settings in the Pebble phone app."));
  assert(!strcmp(label_text[3],"Quick Launch opens your activities."));
  no_setup_work();
  clock_ms+=10000;assert(popped==0); // No four-second attempt budget in setup.
  request();prepare(123,false); // Even forced protocol callbacks cannot acquire an attempt.
  no_setup_work();assert(popped==0);
  back_click(NULL,NULL);assert(popped==1&&default_backs==1);
  no_setup_work();
}
static void appearance_script(void) {
  assert(s_setup_mode && s_dark && window_background==GColorBlack && theme_writes==0);
  DictionaryIterator input={0};dict_write_uint8(&input,OA_KEY_OPERATION,OA_SETTINGS);
  dict_write_uint8(&input,OA_KEY_THEME,0);inbox_received(&input,NULL);
  assert(!s_dark&&window_background==GColorWhite&&stored_theme==0&&theme_writes==1);
  inbox_received(&input,NULL);assert(theme_writes==1);
  dict_find(&input,OA_KEY_THEME)->value->uint8=2;inbox_received(&input,NULL);assert(theme_writes==1);
  dict_find(&input,OA_KEY_THEME)->value->uint8=1;theme_write_fails=true;inbox_received(&input,NULL);
  assert(!s_dark&&window_background==GColorWhite&&stored_theme==0&&theme_writes==2);
  no_setup_work();
}
int main(void) {
  reset();reason=APP_LAUNCH_USER;stored_theme=1;loop_script=appearance_script;helper_app_main();
  assert(stored_theme==0&&font_loads==0&&font_unloads==0);
  const AppLaunchReason setup_reasons[]={APP_LAUNCH_USER,APP_LAUNCH_PHONE,APP_LAUNCH_SYSTEM};
  for(size_t i=0;i<sizeof(setup_reasons)/sizeof(setup_reasons[0]);++i)for(unsigned offline=0;offline<2;++offline){
    reset();reason=setup_reasons[i];connected=!offline;loop_script=setup_script;
    helper_app_main();assert(created==1&&loops==1&&popped==1);
    assert(text_destroys==4&&status_destroys==0&&window_destroys==1&&clock_unsubscribes==1&&font_loads==0&&font_unloads==0);no_setup_work();
  }
  reset();reason=APP_LAUNCH_USER;fail_window=true;helper_app_main();assert(loops==0&&pushed==0&&window_destroys==0);no_setup_work();
    for(int fail=1;fail<=4;++fail){
    reset();reason=APP_LAUNCH_USER;fail_text_at=fail;helper_app_main();
    assert(loops==0&&pushed==0&&text_destroys==fail-1&&status_destroys==0&&window_destroys==1);no_setup_work();
  }
  const AppLaunchReason unsupported_reasons[]={APP_LAUNCH_WAKEUP,APP_LAUNCH_WORKER,APP_LAUNCH_TIMELINE_ACTION,APP_LAUNCH_SMARTSTRAP,(AppLaunchReason)99};
  for(size_t i=0;i<sizeof(unsupported_reasons)/sizeof(unsupported_reasons[0]);++i){
    reset();reason=unsupported_reasons[i];helper_app_main();assert(created==0&&loops==0&&gesture_reads==0&&button_reads==0);
  }
  reset();gesture=APP_QUICK_LAUNCH_ACTION_NONE;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=APP_QUICK_LAUNCH_ACTION_COMBO;button=BUTTON_ID_SELECT;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=APP_QUICK_LAUNCH_ACTION_COMBO;button=BUTTON_ID_DOWN;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=(AppQuickLaunchAction)99;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=APP_QUICK_LAUNCH_ACTION_TAP;button=BUTTON_ID_BACK;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=APP_QUICK_LAUNCH_ACTION_TAP;button=BUTTON_ID_SELECT;helper_app_main();assert(created==0&&loops==0);
  reset();button=NUM_BUTTONS;helper_app_main();assert(created==0&&loops==0);
  reset();connected=false;helper_app_main();assert(created==1&&popped==1&&loops==0);
  reset();opening_result=APP_MSG_ERROR;helper_app_main();assert(popped==1&&loops==0);
  reset();button=BUTTON_ID_UP;loop_script=handshake_script;helper_app_main();assert(loops==1&&popped==1);
  reset();loop_script=back_script;helper_app_main();assert(loops==1&&popped==1);
  reset();loop_script=malformed_script;helper_app_main();assert(loops==1&&popped==1);
  for (ButtonId candidate=BUTTON_ID_BACK;candidate<NUM_BUTTONS;candidate++) {
    reset();button=candidate;loop_script=slot_script;helper_app_main();assert(loops==1&&popped==1);
  }
  for (ButtonId candidate=BUTTON_ID_UP;candidate<=BUTTON_ID_DOWN;candidate+=2) {
    reset();button=candidate;gesture=APP_QUICK_LAUNCH_ACTION_TAP;
    loop_script=slot_script;helper_app_main();assert(loops==1&&popped==1);
  }
  for (ButtonId candidate=BUTTON_ID_BACK;candidate<=BUTTON_ID_UP;candidate++) {
    reset();button=candidate;gesture=APP_QUICK_LAUNCH_ACTION_COMBO;
    loop_script=slot_script;helper_app_main();assert(loops==1&&popped==1);
  }
  puts("native SDK adapter: three setup launch reasons online/offline, no attempt or native activity handshake, settings-only theme receive/cache/failed-write checks, ordinary Back after ten seconds, allocation cleanup, eight slots and gesture wire, unsupported reasons/gestures, handshake, malformed wire, timeout and disconnected closure passed");
  return 0;
}
