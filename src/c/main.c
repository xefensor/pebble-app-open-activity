#include <pebble.h>
#include <pebble-xoce-ui/pebble-xoce-ui.h>

#include "attempt.h"
#include "localization.h"
#include "oa_ui_preferences.h"

static Window *s_window;
static TextLayer *s_label;
static TextLayer *s_setup_body[2];
static ScrollLayer *s_setup_scroll;
static char s_setup_text[2][256];
static Layer *s_header;
static unsigned s_text_size,s_system_text_size;
static OaUiPreferences s_ui_preferences;
static uint8_t s_ui_reply[OA_UI_PREFERENCES_BYTES];
static bool s_ui_pending,s_ui_sending;
static unsigned s_ui_attempts;
static uint32_t s_ui_generation,s_ui_flight;
static bool s_modern_type;
static bool s_dark;
static bool s_message_opened;
static bool s_clock_subscribed;
static char s_clock_text[12];
#define OA_THEME_STORAGE_KEY 1
static bool s_setup_mode;
static AppTimer *s_timeout;
static OaAttempt s_attempt;
static ButtonId s_button;
static AppQuickLaunchAction s_gesture;
static bool s_sending;
static uint8_t s_pending_operation;

static uint32_t now_ms(void) {
  time_t seconds;
  uint16_t milliseconds;
  time_ms(&seconds, &milliseconds);
  return (uint32_t)seconds * 1000u + milliseconds;
}

static void close_helper(bool notify);

static GColor background(void) { return s_dark ? GColorBlack : GColorWhite; }
static GColor foreground(void) { return s_dark ? GColorWhite : GColorBlack; }
static GColor accent(void) { return s_dark ? GColorRichBrilliantLavender : GColorPurple; }
static GColor secondary(void) { return s_dark ? GColorLightGray : GColorDarkGray; }
static void apply_palette(void) {
  if (s_window) window_set_background_color(s_window, background());
  if (s_label) text_layer_set_text_color(s_label, s_setup_mode ? accent() : foreground());
  if (s_header) layer_mark_dirty(s_header);
  for (unsigned i = 0; i < 2; ++i) {
    if (s_setup_body[i]) text_layer_set_text_color(s_setup_body[i], foreground());
  }
}
static void load_ui(void) {
  oa_ui_preferences_load(&s_ui_preferences);
  s_dark=oa_ui_preferences_dark(&s_ui_preferences);s_system_text_size=preferred_content_size();
  s_text_size=xoce_ui_effective_text_size(s_ui_preferences.text_size,s_system_text_size);
  const WatchInfoVersion firmware = watch_info_get_firmware_version();
  s_modern_type = firmware.major > 4 || (firmware.major == 4 && firmware.minor >= 44);
}
static void draw_header(Layer *layer,GContext *ctx) {
  const int width = layer_get_bounds(layer).size.w;
  const XoceUiHeaderLayout layout = xoce_ui_native_header_layout(s_clock_text,
      s_text_size,s_modern_type,width,8,XOCE_UI_HEADER_HEIGHT);
  xoce_ui_native_draw(ctx,app_heading("Activity"),s_text_size,XOCE_UI_TYPE_HEADER,
      s_modern_type,layout.label,foreground(),GTextAlignmentLeft,GTextOverflowModeTrailingEllipsis);
  xoce_ui_native_draw(ctx,s_clock_text,s_text_size,XOCE_UI_TYPE_HEADER,
      s_modern_type,layout.clock,foreground(),GTextAlignmentRight,GTextOverflowModeWordWrap);
  graphics_context_set_stroke_color(ctx,secondary());
  graphics_draw_line(ctx,GPoint(0,layout.height-1),GPoint(width,layout.height-1));
}
static void refresh_setup_language(void) {
  if (!s_setup_scroll) return;
  const char *source[][2]={{"Open settings in","the Pebble app."},{"Quick Launch","opens activities."}};
  const GRect bounds = layer_get_bounds(window_get_root_layer(s_window));
  const int header_height = xoce_ui_native_header_layout("22:58",s_text_size,
      s_modern_type,bounds.size.w,8,XOCE_UI_HEADER_HEIGHT).height;
  const int viewport = bounds.size.h-header_height;
  const int width = bounds.size.w-32;
  int heights[2];
  for (unsigned i=0;i<2;++i) {
    snprintf(s_setup_text[i],sizeof(s_setup_text[i]),"%s %s",app_text(source[i][0]),app_text(source[i][1]));
    const XoceUiTypeRole role=i?XOCE_UI_TYPE_MENU_SUBTITLE:XOCE_UI_TYPE_MENU_TITLE;
    heights[i]=xoce_ui_native_measure(s_setup_text[i],s_text_size,role,s_modern_type,width-2).h+8;
    text_layer_set_text(s_setup_body[i],s_setup_text[i]);
  }
  const int text_height=heights[0]+24+heights[1];
  int y=text_height+32<viewport?(viewport-text_height)/2:16;
  for (unsigned i=0;i<2;++i) {
    layer_set_frame(text_layer_get_layer(s_setup_body[i]),GRect(16,y,width,heights[i]));
    y+=heights[i]+(i?16:24);
  }
  scroll_layer_set_content_size(s_setup_scroll,(GSize){bounds.size.w,y>viewport?y:viewport});
}
static void apply_ui_preferences(const OaUiPreferences *value){
  s_ui_preferences=*value;s_dark=oa_ui_preferences_dark(value);
  s_text_size=xoce_ui_effective_text_size(value->text_size,s_system_text_size);
  const GRect bounds=layer_get_bounds(window_get_root_layer(s_window));
  const int header_height=xoce_ui_native_header_layout("22:58",s_text_size,
      s_modern_type,bounds.size.w,8,XOCE_UI_HEADER_HEIGHT).height;
  layer_set_frame(s_header,GRect(0,0,bounds.size.w,header_height));
  layer_set_frame(scroll_layer_get_layer(s_setup_scroll),GRect(0,header_height,bounds.size.w,bounds.size.h-header_height));
  for(unsigned i=0;i<2;++i)text_layer_set_font(s_setup_body[i],fonts_get_system_font(
      xoce_ui_native_font_key(s_text_size,i?XOCE_UI_TYPE_MENU_SUBTITLE:XOCE_UI_TYPE_MENU_TITLE,s_modern_type)));
  refresh_setup_language();apply_palette();
}
static void flush_ui_reply(void){
  if(!s_setup_mode||!s_message_opened||s_sending||!s_ui_pending||s_ui_attempts>=3||!connection_service_peek_pebble_app_connection())return;
  ++s_ui_attempts;DictionaryIterator *out;
  if(app_message_outbox_begin(&out)!=APP_MSG_OK)return;
  dict_write_data(out,OA_KEY_UI_PREFERENCES_RESULT,s_ui_reply,sizeof(s_ui_reply));
  s_sending=true;s_ui_sending=true;s_ui_pending=false;s_ui_flight=s_ui_generation;
  if(app_message_outbox_send()!=APP_MSG_OK){s_sending=false;s_ui_sending=false;s_ui_pending=true;}
}
static void ui_reply(const OaUiPreferences *value,uint8_t status,uint8_t flags){
  oa_ui_preferences_encode(value,status,flags,s_ui_reply);++s_ui_generation;
  s_ui_attempts=0;s_ui_pending=true;flush_ui_reply();
}
static void clock_tick(struct tm *tick_time, TimeUnits units) {
  refresh_setup_language();
  (void)units;
  strftime(s_clock_text, sizeof(s_clock_text), clock_is_24h_style() ? "%H:%M" : "%I:%M", tick_time);
  if (!clock_is_24h_style() && s_clock_text[0] == '0') memmove(s_clock_text, s_clock_text + 1, strlen(s_clock_text));
  if (s_header) layer_mark_dirty(s_header);
}
static void receive_theme(DictionaryIterator *message);


static bool read_uint(DictionaryIterator *message, uint32_t key, uint32_t *value) {
  Tuple *tuple = dict_find(message, key);
  if (!tuple || (tuple->type != TUPLE_UINT && tuple->type != TUPLE_INT)) return false;
  if (tuple->length == 1) {
    if (tuple->type == TUPLE_INT && tuple->value->int8 < 0) return false;
    *value = tuple->value->uint8;
  } else if (tuple->length == 2) {
    if (tuple->type == TUPLE_INT && tuple->value->int16 < 0) return false;
    *value = tuple->value->uint16;
  } else if (tuple->length == 4) {
    if (tuple->type == TUPLE_INT && tuple->value->int32 < 0) return false;
    *value = tuple->value->uint32;
  } else return false;
  return true;
}

static void receive_theme(DictionaryIterator *message) {
  uint32_t theme;
  if (!read_uint(message, OA_KEY_THEME, &theme) || theme > 1 || (bool)theme == s_dark) return;
  if(s_ui_preferences.revision){
    if(!s_setup_mode||theme==(uint32_t)(s_ui_preferences.last_explicit==OA_UI_DARK))return;
    OaUiPreferences chosen=s_ui_preferences;chosen.appearance=chosen.last_explicit=theme?OA_UI_DARK:OA_UI_LIGHT;
    if(oa_ui_preferences_save(&chosen))apply_ui_preferences(&chosen);
    return;
  }
  // Only confirmed native preference storage changes the cached first frame.
  if (persist_write_int(OA_THEME_STORAGE_KEY, (int32_t)theme) != (int)sizeof(int32_t) ||
      persist_read_int(OA_THEME_STORAGE_KEY) != (int32_t)theme) return;
  s_dark = theme != 0;
  s_ui_preferences.appearance=s_ui_preferences.last_explicit=s_dark?OA_UI_DARK:OA_UI_LIGHT;
  apply_palette();
}

static void send_operation(uint8_t operation) {
  if (s_attempt.phase == OA_CLOSED && operation != OA_CANCEL) return;
  if (s_sending) { s_pending_operation = operation; return; }
  DictionaryIterator *message;
  if (app_message_outbox_begin(&message) != APP_MSG_OK) {
    if (operation != OA_CANCEL) close_helper(false);
    return;
  }
  dict_write_uint8(message, OA_KEY_OPERATION, operation);
  dict_write_uint32(message, OA_KEY_SESSION, s_attempt.session);
  dict_write_uint32(message, OA_KEY_ELAPSED_MS, oa_attempt_elapsed(&s_attempt, now_ms()));
  if (operation == OA_HELLO) {
    dict_write_uint8(message, OA_KEY_BUTTON, s_button);
    dict_write_uint8(message, OA_KEY_GESTURE, s_gesture);
  }
  if (operation == OA_CONFIRM) {
    dict_write_uint32(message, OA_KEY_TICKET, s_attempt.ticket);
    dict_write_uint8(message, OA_KEY_ROLE, s_attempt.role);
    dict_write_cstring(message, OA_KEY_DESTINATION, s_attempt.destination);
  }
  s_sending = true;
  if (app_message_outbox_send() != APP_MSG_OK) {
    s_sending = false;
    if (operation != OA_CANCEL) close_helper(false);
  }
}

static void close_helper(bool notify) {
  if (s_attempt.phase == OA_CLOSED) return;
  // Best effort only: exiting cannot recall a phone launch already dispatched.
  if (notify && !s_sending) send_operation(OA_CANCEL);
  oa_attempt_close(&s_attempt);
  s_pending_operation = 0;
  if (s_timeout) { app_timer_cancel(s_timeout); s_timeout = NULL; }
  window_stack_pop_all(false);
}

static void timeout_handler(void *context) {
  (void)context;
  s_timeout = NULL;
  close_helper(true);
}

static void back_handler(ClickRecognizerRef recognizer, void *context) {
  (void)recognizer; (void)context;
  close_helper(true);
}

static void click_config(void *context) {
  (void)context;
  window_single_click_subscribe(BUTTON_ID_BACK, back_handler);
}

static void connection_changed(bool connected) {
  if(s_setup_mode){if(connected)ui_reply(&s_ui_preferences,OA_UI_APPLIED,OA_UI_HELLO);return;}
  if (!connected) close_helper(true);
}

static void inbox_received(DictionaryIterator *message, void *context) {
  (void)context;
  uint32_t operation, session;
  Tuple *ui=dict_find(message,OA_KEY_UI_PREFERENCES);
  if(ui){
    // Preference delivery never joins the four-second launch queue.
    if(!s_setup_mode)return;
    OaUiPreferences requested,confirmed;uint8_t status,flags;
    if(ui->type==TUPLE_BYTE_ARRAY&&oa_ui_preferences_decode(ui->value->data,ui->length,&requested,&status,&flags)&&requested.revision&&!status&&!flags){
      if(oa_ui_preferences_save(&requested)&&oa_ui_preferences_load(&confirmed)){
        apply_ui_preferences(&confirmed);ui_reply(&confirmed,OA_UI_APPLIED,0);
      }else ui_reply(&requested,OA_UI_SAVE_FAILED,0);
    }
    return;
  }
  if (!read_uint(message, OA_KEY_OPERATION, &operation)) return;
  if (s_setup_mode) {
    if(operation==OA_REQUEST||operation==OA_SETTINGS){receive_theme(message);ui_reply(&s_ui_preferences,OA_UI_APPLIED,OA_UI_HELLO);}
    return; // Setup never acquires a launch session or navigation capability.
  }
  if (operation == OA_SETTINGS) return;
  if (!oa_attempt_current(&s_attempt, s_attempt.session, now_ms())) { close_helper(true); return; }
  if (operation == OA_REQUEST) {
    receive_theme(message);
    if (s_attempt.phase == OA_WAITING) send_operation(OA_HELLO);
    return;
  }
  if (!read_uint(message, OA_KEY_SESSION, &session) || session != s_attempt.session) return;
  if (operation == OA_CLOSE) { close_helper(false); return; }
  if (operation != OA_PREPARE) return;
  uint32_t ticket, role;
  Tuple *destination = dict_find(message, OA_KEY_DESTINATION);
  if (!read_uint(message, OA_KEY_TICKET, &ticket) || !read_uint(message, OA_KEY_ROLE, &role) ||
      role > UINT8_MAX || !destination || destination->type != TUPLE_CSTRING ||
      destination->length != OA_UUID_LENGTH + 1) {
    close_helper(true); return;
  }
  char destination_text[OA_UUID_LENGTH + 1];
  memcpy(destination_text, (const void *)destination->value, sizeof(destination_text));
  if (destination_text[OA_UUID_LENGTH] != '\0') { close_helper(true); return; }
  if (s_attempt.phase == OA_CONFIRMED) return;
  if (!oa_attempt_prepare(&s_attempt, session, ticket, (uint8_t)role,
                          destination_text, now_ms())) { close_helper(true); return; }
  send_operation(OA_CONFIRM);
}

static void outbox_sent(DictionaryIterator *message, void *context) {
  (void)context;
  if(s_ui_sending||(message&&dict_find(message,OA_KEY_UI_PREFERENCES_RESULT))){s_sending=false;s_ui_sending=false;flush_ui_reply();return;}
  s_sending = false;
  uint8_t next = s_pending_operation;
  s_pending_operation = 0;
  if (next && s_attempt.phase != OA_CLOSED) send_operation(next);
}

static void outbox_failed(DictionaryIterator *message, AppMessageResult error, void *context) {
  (void)error;(void)context;
  if(s_ui_sending||(message&&dict_find(message,OA_KEY_UI_PREFERENCES_RESULT))){s_sending=false;s_ui_sending=false;if(s_ui_flight==s_ui_generation)s_ui_pending=true;flush_ui_reply();return;}
  s_sending = false;
  close_helper(false);
}

static void init(uint32_t started) {
  uint32_t session = (started ^ (uint32_t)(uintptr_t)&s_attempt ^ 0x6f70656eu) & 0x7fffffffu;
  if (!session) session = 1;
  oa_attempt_init(&s_attempt, session, started);
  s_window = window_create();
  if (!s_window) { oa_attempt_close(&s_attempt); return; }
  window_set_background_color(s_window, background());
  window_set_click_config_provider(s_window, click_config);
  Layer *layer = window_get_root_layer(s_window);
  GRect bounds = layer_get_bounds(layer);
  const int opening_height=xoce_ui_native_measure(app_text("Opening..."),s_text_size,
      XOCE_UI_TYPE_MENU_TITLE,s_modern_type,bounds.size.w-22).h+8;
  s_label = text_layer_create(GRect(10, (bounds.size.h - opening_height) / 2, bounds.size.w - 20, opening_height));
  if (!s_label) { oa_attempt_close(&s_attempt); return; }
  text_layer_set_text(s_label, app_text("Opening..."));
  text_layer_set_font(s_label, fonts_get_system_font(xoce_ui_native_font_key(
      s_text_size,XOCE_UI_TYPE_MENU_TITLE,s_modern_type)));
  text_layer_set_overflow_mode(s_label,GTextOverflowModeWordWrap);
  text_layer_set_text_alignment(s_label, GTextAlignmentCenter);
  text_layer_set_text_color(s_label, foreground());
  text_layer_set_background_color(s_label, GColorClear);
  layer_add_child(layer, text_layer_get_layer(s_label));
  window_stack_push(s_window, false);
  uint32_t elapsed = oa_attempt_elapsed(&s_attempt, now_ms());
  if (elapsed >= OA_BUDGET_MS) { close_helper(false); return; }
  s_timeout = app_timer_register(OA_BUDGET_MS - elapsed, timeout_handler, NULL);
  if (!s_timeout) { close_helper(false); return; }
  app_message_register_inbox_received(inbox_received);
  app_message_register_outbox_sent(outbox_sent);
  app_message_register_outbox_failed(outbox_failed);
  if (app_message_open(192, 192) != APP_MSG_OK) { close_helper(false); return; }
  s_message_opened = true;
  connection_service_subscribe((ConnectionHandlers){.pebble_app_connection_handler = connection_changed});
  if (!connection_service_peek_pebble_app_connection()) close_helper(false);
}

static bool init_setup(void) {
  s_setup_mode = true;
  // An ordinary launch is a settings surface, never an opening attempt.
  oa_attempt_close(&s_attempt);
  s_window = window_create();
  if (!s_window) return false;
  window_set_background_color(s_window, background());
  Layer *layer = window_get_root_layer(s_window);
  GRect bounds = layer_get_bounds(layer);
  const int header_height=xoce_ui_native_header_layout("22:58",s_text_size,
      s_modern_type,bounds.size.w,8,XOCE_UI_HEADER_HEIGHT).height;
  s_header = layer_create(GRect(0,0,bounds.size.w,header_height));
  if (!s_header) return false;
  layer_set_update_proc(s_header,draw_header);
  layer_add_child(layer,s_header);
  s_setup_scroll=scroll_layer_create(GRect(0,header_height,bounds.size.w,bounds.size.h-header_height));
  if (!s_setup_scroll) return false;
  layer_add_child(layer,scroll_layer_get_layer(s_setup_scroll));
  // Native scrolling keeps complete instructions reachable at every OS size.
  // It owns setup's Up/Down clicks; normal Back still leaves this passive screen.
  scroll_layer_set_click_config_onto_window(s_setup_scroll,s_window);
  for (unsigned i=0;i<2;++i) {
    s_setup_body[i]=text_layer_create(GRect(16,0,bounds.size.w-32,1));
    if (!s_setup_body[i]) return false;
    text_layer_set_font(s_setup_body[i],fonts_get_system_font(xoce_ui_native_font_key(
        s_text_size,i?XOCE_UI_TYPE_MENU_SUBTITLE:XOCE_UI_TYPE_MENU_TITLE,s_modern_type)));
    text_layer_set_overflow_mode(s_setup_body[i],GTextOverflowModeWordWrap);
    text_layer_set_text_alignment(s_setup_body[i],GTextAlignmentLeft);
    text_layer_set_background_color(s_setup_body[i],GColorClear);
    scroll_layer_add_child(s_setup_scroll,text_layer_get_layer(s_setup_body[i]));
  }
  apply_palette();
  time_t now = time(NULL);
  clock_tick(localtime(&now), MINUTE_UNIT);
  tick_timer_service_subscribe(MINUTE_UNIT, clock_tick);
  s_clock_subscribed = true;
  // This channel confirms public display preferences. No activity HELLO,
  // attempt timeout, session or source subscription is created.
  app_message_register_inbox_received(inbox_received);
  app_message_register_outbox_sent(outbox_sent);app_message_register_outbox_failed(outbox_failed);
  connection_service_subscribe((ConnectionHandlers){.pebble_app_connection_handler=connection_changed});
  if (app_message_open(192, 192) == APP_MSG_OK) s_message_opened = true;
  // Leave Back to the normal window-stack handler. There is no attempt to cancel.
  window_stack_push(s_window, false);
  ui_reply(&s_ui_preferences,OA_UI_APPLIED,OA_UI_HELLO);
  return true;
}

static void deinit(void) {
  if (s_timeout) app_timer_cancel(s_timeout);
  oa_attempt_close(&s_attempt);
  connection_service_unsubscribe();
  if (!s_setup_mode) {
    app_message_deregister_callbacks();
  }
  for (unsigned i = 0; i < 2; ++i) {
    if (s_setup_body[i]) text_layer_destroy(s_setup_body[i]);
  }
  if (s_setup_scroll) scroll_layer_destroy(s_setup_scroll);
  if (s_label) text_layer_destroy(s_label);
  if (s_header) layer_destroy(s_header);
  if (s_clock_subscribed) tick_timer_service_unsubscribe();
  if (s_setup_mode && s_message_opened) app_message_deregister_callbacks();
  if (s_window) window_destroy(s_window);
}

int main(void) {
  uint32_t started = now_ms();
  AppLaunchReason reason = launch_reason();
  if (reason == APP_LAUNCH_USER || reason == APP_LAUNCH_PHONE || reason == APP_LAUNCH_SYSTEM) {
    load_ui();
    if (init_setup()) app_event_loop();
    deinit();
    return 0;
  }
  if (reason != APP_LAUNCH_QUICK_LAUNCH) return 0;
  s_gesture = launch_get_quick_launch_action();
  s_button = launch_button();
  if ((unsigned)s_button >= NUM_BUTTONS) return 0;
  bool supported = s_gesture == APP_QUICK_LAUNCH_ACTION_HOLD ||
    (s_gesture == APP_QUICK_LAUNCH_ACTION_TAP &&
     (s_button == BUTTON_ID_UP || s_button == BUTTON_ID_DOWN)) ||
    (s_gesture == APP_QUICK_LAUNCH_ACTION_COMBO &&
     (s_button == BUTTON_ID_BACK || s_button == BUTTON_ID_UP));
  if (!supported) return 0;
  load_ui();
  init(started);
  if (s_attempt.phase != OA_CLOSED) app_event_loop();
  deinit();
  return 0;
}
