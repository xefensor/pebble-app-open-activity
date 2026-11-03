#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "protocol.h"

typedef enum { OA_WAITING, OA_CONFIRMED, OA_CLOSED } OaPhase;

typedef struct {
  OaPhase phase;
  uint32_t session;
  uint32_t started_ms;
  uint32_t ticket;
  uint8_t role;
  char destination[OA_UUID_LENGTH + 1];
} OaAttempt;

void oa_attempt_init(OaAttempt *attempt, uint32_t session, uint32_t now_ms);
uint32_t oa_attempt_elapsed(const OaAttempt *attempt, uint32_t now_ms);
bool oa_attempt_current(const OaAttempt *attempt, uint32_t session, uint32_t now_ms);
bool oa_attempt_prepare(OaAttempt *attempt, uint32_t session, uint32_t ticket,
                        uint8_t role, const char *destination, uint32_t now_ms);
void oa_attempt_close(OaAttempt *attempt);
bool oa_destination_valid(const char *value);
