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
static AppMessageResult opening_result;
static DictionaryIterator outgoing;
static AppTimer timer;
static Window window;
static TextLayer label;
static Layer layer;
static void (*loop_script)(void);
static void (*back_click)(ClickRecognizerRef,void *);

AppLaunchReason launch_reason(void) {return reason;}
AppQuickLaunchAction launch_get_quick_launch_action(void) {return gesture;}
ButtonId launch_button(void) {return button;}
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
AppMessageResult app_message_outbox_begin(DictionaryIterator **value) {outgoing.count=0;*value=&outgoing;return APP_MSG_OK;}
AppMessageResult app_message_outbox_send(void) {sent++;return APP_MSG_OK;}
AppMessageResult app_message_open(uint32_t in,uint32_t out) {assert(in==192&&out==192);return opening_result;}
void app_message_register_inbox_received(void (*fn)(DictionaryIterator *,void *)) {(void)fn;}
void app_message_register_outbox_sent(void (*fn)(DictionaryIterator *,void *)) {(void)fn;}
void app_message_register_outbox_failed(void (*fn)(DictionaryIterator *,AppMessageResult,void *)) {(void)fn;}
void app_message_deregister_callbacks(void) {}
AppTimer *app_timer_register(uint32_t delay,void (*callback)(void *),void *ctx) {(void)ctx;timer=(AppTimer){true,delay,callback};return &timer;}
void app_timer_cancel(AppTimer *value) {value->active=false;}
void window_stack_pop_all(bool animated) {assert(!animated);popped++;}
void window_stack_push(Window *value,bool animated) {(void)value;assert(!animated);pushed++;}
void window_single_click_subscribe(ButtonId value,void (*fn)(ClickRecognizerRef,void *)) {assert(value==BUTTON_ID_BACK);back_click=fn;}
Window *window_create(void) {created++;return &window;}
void window_set_background_color(Window *value,GColor color) {(void)value;(void)color;}
void window_set_click_config_provider(Window *value,void (*fn)(void *)) {(void)value;fn(NULL);}
Layer *window_get_root_layer(Window *value) {(void)value;return &layer;}
GRect layer_get_bounds(Layer *value) {(void)value;return GRect(0,0,200,228);}
TextLayer *text_layer_create(GRect rect) {assert(rect.origin.x>=0&&rect.size.w<=200&&rect.origin.y>=0&&rect.origin.y+rect.size.h<=228);return &label;}
void text_layer_set_text(TextLayer *value,const char *text) {(void)value;assert(strcmp(text,"Opening...")==0);}
void text_layer_set_font(TextLayer *value,GFont font) {(void)value;(void)font;}
void text_layer_set_text_alignment(TextLayer *value,int alignment) {(void)value;(void)alignment;}
void text_layer_set_text_color(TextLayer *value,GColor color) {(void)value;(void)color;}
void text_layer_set_background_color(TextLayer *value,GColor color) {(void)value;(void)color;}
GFont fonts_get_system_font(const char *key) {return key;}
Layer *text_layer_get_layer(TextLayer *value) {(void)value;return &layer;}
void layer_add_child(Layer *parent,Layer *child) {(void)parent;(void)child;}
void text_layer_destroy(TextLayer *value) {(void)value;}
void window_destroy(Window *value) {(void)value;}
void connection_service_subscribe(ConnectionHandlers handlers) {(void)handlers;}
void connection_service_unsubscribe(void) {}
bool connection_service_peek_pebble_app_connection(void) {return connected;}
void app_event_loop(void) {loops++;if(loop_script)loop_script();}

static void reset(void) {
  reason=APP_LAUNCH_QUICK_LAUNCH;gesture=APP_QUICK_LAUNCH_ACTION_HOLD;
  button=BUTTON_ID_DOWN;connected=true;clock_ms=1000;
  created=pushed=popped=loops=sent=0;opening_result=APP_MSG_OK;
  s_window=NULL;s_label=NULL;s_timeout=NULL;s_sending=false;s_pending_operation=0;
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
int main(void) {
  reset();reason=APP_LAUNCH_USER;helper_app_main();assert(created==0&&loops==0);
  reset();reason=APP_LAUNCH_PHONE;helper_app_main();assert(created==0&&loops==0);
  reset();gesture=APP_QUICK_LAUNCH_ACTION_TAP;helper_app_main();assert(created==0&&loops==0);
  reset();button=NUM_BUTTONS;helper_app_main();assert(created==0&&loops==0);
  reset();connected=false;helper_app_main();assert(created==1&&popped==1&&loops==0);
  reset();opening_result=APP_MSG_ERROR;helper_app_main();assert(popped==1&&loops==0);
  reset();button=BUTTON_ID_UP;loop_script=handshake_script;helper_app_main();assert(loops==1&&popped==1);
  reset();loop_script=back_script;helper_app_main();assert(loops==1&&popped==1);
  reset();loop_script=malformed_script;helper_app_main();assert(loops==1&&popped==1);
  puts("native SDK adapter: launch gating, handshake, malformed wire, timeout, Back and disconnected closure passed");
  return 0;
}
