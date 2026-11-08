#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

enum {
  OA_UI_PREFERENCES_BYTES=20,
  OA_UI_APPLIED=0,
  OA_UI_SAVE_FAILED=1,
  OA_UI_HELLO=1,
  OA_UI_FOLLOW=0,
  OA_UI_LIGHT=1,
  OA_UI_DARK=2
};
typedef struct {
  uint32_t revision;
  uint8_t text_size,appearance,last_explicit;
} OaUiPreferences;

/* A local UI preference never belongs to a shortcut mapping or opening nonce. */
OaUiPreferences oa_ui_preferences_defaults(bool legacy_dark);
bool oa_ui_preferences_valid(const OaUiPreferences *value);
void oa_ui_preferences_encode(const OaUiPreferences *value,uint8_t status,
    uint8_t flags,uint8_t bytes[OA_UI_PREFERENCES_BYTES]);
bool oa_ui_preferences_decode(const uint8_t *bytes,size_t length,
    OaUiPreferences *value,uint8_t *status,uint8_t *flags);
bool oa_ui_preferences_dark(const OaUiPreferences *value);
bool oa_ui_preferences_load(OaUiPreferences *value);
bool oa_ui_preferences_save(const OaUiPreferences *value);
