#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <time.h>

typedef enum { BUTTON_ID_BACK, BUTTON_ID_UP, BUTTON_ID_SELECT, BUTTON_ID_DOWN, NUM_BUTTONS } ButtonId;
typedef enum { APP_LAUNCH_SYSTEM, APP_LAUNCH_USER, APP_LAUNCH_PHONE, APP_LAUNCH_QUICK_LAUNCH } AppLaunchReason;
typedef enum { APP_QUICK_LAUNCH_ACTION_NONE, APP_QUICK_LAUNCH_ACTION_HOLD, APP_QUICK_LAUNCH_ACTION_TAP, APP_QUICK_LAUNCH_ACTION_COMBO } AppQuickLaunchAction;
typedef enum { APP_MSG_OK, APP_MSG_ERROR } AppMessageResult;
enum { TUPLE_BYTE_ARRAY, TUPLE_CSTRING, TUPLE_UINT, TUPLE_INT };
typedef union { int8_t int8; uint8_t uint8; int16_t int16; uint16_t uint16; int32_t int32; uint32_t uint32; char cstring[64]; } TupleValue;
typedef struct { uint32_t key; uint8_t type; uint16_t length; TupleValue *value; } Tuple;
typedef struct { size_t count; Tuple tuples[8]; TupleValue values[8]; } DictionaryIterator;
typedef struct { struct {int16_t x,y;} origin; struct {int16_t w,h;} size; } GRect;
#define GRect(x,y,w,h) ((GRect){{x,y},{w,h}})
typedef struct {int unused;} Window;
typedef struct {int unused;} Layer;
typedef struct {int unused;} TextLayer;
typedef struct {bool active; uint32_t delay; void (*callback)(void *);} AppTimer;
typedef void *ClickRecognizerRef;
typedef int GColor;
typedef const void *GFont;
enum {GColorWhite,GColorBlack,GColorClear,GTextAlignmentCenter};
#define FONT_KEY_GOTHIC_28_BOLD "GOTHIC_28_BOLD"
typedef struct {void (*pebble_app_connection_handler)(bool);} ConnectionHandlers;

AppLaunchReason launch_reason(void);
AppQuickLaunchAction launch_get_quick_launch_action(void);
ButtonId launch_button(void);
uint16_t time_ms(time_t *,uint16_t *);
Tuple *dict_find(DictionaryIterator *,uint32_t);
void dict_write_uint8(DictionaryIterator *,uint32_t,uint8_t);
void dict_write_uint32(DictionaryIterator *,uint32_t,uint32_t);
void dict_write_cstring(DictionaryIterator *,uint32_t,const char *);
AppMessageResult app_message_outbox_begin(DictionaryIterator **);
AppMessageResult app_message_outbox_send(void);
AppMessageResult app_message_open(uint32_t,uint32_t);
void app_message_register_inbox_received(void (*)(DictionaryIterator *,void *));
void app_message_register_outbox_sent(void (*)(DictionaryIterator *,void *));
void app_message_register_outbox_failed(void (*)(DictionaryIterator *,AppMessageResult,void *));
void app_message_deregister_callbacks(void);
AppTimer *app_timer_register(uint32_t,void (*)(void *),void *);
void app_timer_cancel(AppTimer *);
void window_stack_pop_all(bool);
void window_stack_push(Window *,bool);
void window_single_click_subscribe(ButtonId,void (*)(ClickRecognizerRef,void *));
Window *window_create(void);
void window_set_background_color(Window *,GColor);
void window_set_click_config_provider(Window *,void (*)(void *));
Layer *window_get_root_layer(Window *);
GRect layer_get_bounds(Layer *);
TextLayer *text_layer_create(GRect);
void text_layer_set_text(TextLayer *,const char *);
void text_layer_set_font(TextLayer *,GFont);
void text_layer_set_text_alignment(TextLayer *,int);
void text_layer_set_text_color(TextLayer *,GColor);
void text_layer_set_background_color(TextLayer *,GColor);
GFont fonts_get_system_font(const char *);
Layer *text_layer_get_layer(TextLayer *);
void layer_add_child(Layer *,Layer *);
void text_layer_destroy(TextLayer *);
void window_destroy(Window *);
void connection_service_subscribe(ConnectionHandlers);
void connection_service_unsubscribe(void);
bool connection_service_peek_pebble_app_connection(void);
void app_event_loop(void);
