#include <pebble.h>
#include <string.h>
#include "oa_ui_preferences.h"

#define UI_PREFERENCES_KEY 2

static uint32_t prv_u32(const uint8_t *at) {
  return (uint32_t)at[0]|(uint32_t)at[1]<<8|(uint32_t)at[2]<<16|(uint32_t)at[3]<<24;
}
static void prv_put_u32(uint8_t *at,uint32_t value) {
  for(unsigned i=0;i<4;++i)at[i]=(uint8_t)(value>>(8*i));
}
OaUiPreferences oa_ui_preferences_defaults(bool legacy_dark) {
  const uint8_t appearance=legacy_dark?OA_UI_DARK:OA_UI_LIGHT;
  return (OaUiPreferences){0,0,appearance,appearance};
}
bool oa_ui_preferences_valid(const OaUiPreferences *value) {
  return value&&value->text_size<=3&&value->appearance<=OA_UI_DARK&&
      value->last_explicit>=OA_UI_LIGHT&&value->last_explicit<=OA_UI_DARK&&
      (value->appearance==OA_UI_FOLLOW||value->appearance==value->last_explicit);
}
void oa_ui_preferences_encode(const OaUiPreferences *value,uint8_t status,
    uint8_t flags,uint8_t bytes[OA_UI_PREFERENCES_BYTES]) {
  memset(bytes,0,OA_UI_PREFERENCES_BYTES);
  bytes[0]=1;bytes[1]=3;bytes[2]=status;bytes[3]=flags;
  prv_put_u32(bytes+4,value->revision);prv_put_u32(bytes+8,value->text_size);
  prv_put_u32(bytes+12,value->appearance);prv_put_u32(bytes+16,value->last_explicit);
}
bool oa_ui_preferences_decode(const uint8_t *bytes,size_t length,
    OaUiPreferences *value,uint8_t *status,uint8_t *flags) {
  if(!bytes||!value||length!=OA_UI_PREFERENCES_BYTES||bytes[0]!=1||bytes[1]!=3||
      bytes[2]>OA_UI_SAVE_FAILED||(bytes[3]&~OA_UI_HELLO)||
      prv_u32(bytes+8)>3||prv_u32(bytes+12)>2||prv_u32(bytes+16)>2)return false;
  const OaUiPreferences decoded={prv_u32(bytes+4),(uint8_t)prv_u32(bytes+8),
      (uint8_t)prv_u32(bytes+12),(uint8_t)prv_u32(bytes+16)};
  if(!oa_ui_preferences_valid(&decoded))return false;
  *value=decoded;
  if(status)*status=bytes[2];
  if(flags)*flags=bytes[3];
  return true;
}
bool oa_ui_preferences_dark(const OaUiPreferences *value) {
  return (value->appearance==OA_UI_FOLLOW?value->last_explicit:value->appearance)==OA_UI_DARK;
}
bool oa_ui_preferences_load(OaUiPreferences *value) {
  *value=oa_ui_preferences_defaults((persist_exists(1)&&persist_read_int(1)==1));
  if(!persist_exists(UI_PREFERENCES_KEY))return true;
  uint8_t bytes[OA_UI_PREFERENCES_BYTES],status,flags;
  OaUiPreferences stored;
  if(persist_get_size(UI_PREFERENCES_KEY)!=(int)sizeof(bytes)||
      persist_read_data(UI_PREFERENCES_KEY,bytes,sizeof(bytes))!=(int)sizeof(bytes)||
      !oa_ui_preferences_decode(bytes,sizeof(bytes),&stored,&status,&flags)||
      status||flags||!stored.revision)return false;
  *value=stored;return true;
}
bool oa_ui_preferences_save(const OaUiPreferences *value) {
  if(!oa_ui_preferences_valid(value)||!value->revision)return false;
  uint8_t bytes[OA_UI_PREFERENCES_BYTES],readback[OA_UI_PREFERENCES_BYTES];
  oa_ui_preferences_encode(value,OA_UI_APPLIED,0,bytes);
  const bool same=persist_exists(UI_PREFERENCES_KEY)&&
      persist_read_data(UI_PREFERENCES_KEY,readback,sizeof(readback))==(int)sizeof(readback)&&
      !memcmp(readback,bytes,sizeof(bytes));
  if(!same&&persist_write_data(UI_PREFERENCES_KEY,bytes,sizeof(bytes))!=(int)sizeof(bytes))return false;
  if(persist_get_size(UI_PREFERENCES_KEY)!=(int)sizeof(bytes)||
      persist_read_data(UI_PREFERENCES_KEY,readback,sizeof(readback))!=(int)sizeof(readback)||
      memcmp(readback,bytes,sizeof(bytes)))return false;
  /* The verified blob is authoritative. Keep the older colour-only build's
   * fallback current without coupling this commit to any shortcut record. */
  (void)persist_write_int(1,oa_ui_preferences_dark(value)?1:0);
  return true;
}
