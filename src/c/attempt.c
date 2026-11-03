#include "attempt.h"

#include <stddef.h>
#include <string.h>

bool oa_destination_valid(const char *value) {
  if (!value) return false;
  bool nonzero = false;
  for (size_t i = 0; i < OA_UUID_LENGTH; ++i) {
    char ch = value[i];
    if (!ch) return false;
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (ch != '-') return false;
    } else {
      if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
      if (ch != '0') nonzero = true;
    }
  }
  return value[OA_UUID_LENGTH] == '\0' && nonzero && strcmp(value, OA_HELPER_UUID) != 0;
}

void oa_attempt_init(OaAttempt *attempt, uint32_t session, uint32_t now_ms) {
  memset(attempt, 0, sizeof(*attempt));
  attempt->session = session;
  attempt->started_ms = now_ms;
  attempt->phase = session ? OA_WAITING : OA_CLOSED;
}

uint32_t oa_attempt_elapsed(const OaAttempt *attempt, uint32_t now_ms) {
  return now_ms - attempt->started_ms;
}

bool oa_attempt_current(const OaAttempt *attempt, uint32_t session, uint32_t now_ms) {
  return attempt->phase != OA_CLOSED && session && session == attempt->session &&
      oa_attempt_elapsed(attempt, now_ms) < OA_BUDGET_MS;
}

bool oa_attempt_prepare(OaAttempt *attempt, uint32_t session, uint32_t ticket,
                        uint8_t role, const char *destination, uint32_t now_ms) {
  if (attempt->phase != OA_WAITING || !oa_attempt_current(attempt, session, now_ms) ||
      !ticket || (role != OA_PRIMARY && role != OA_SECONDARY) ||
      !oa_destination_valid(destination)) return false;
  attempt->ticket = ticket;
  attempt->role = role;
  memcpy(attempt->destination, destination, sizeof(attempt->destination));
  attempt->phase = OA_CONFIRMED;
  return true;
}

void oa_attempt_close(OaAttempt *attempt) {
  attempt->phase = OA_CLOSED;
  attempt->ticket = 0;
  memset(attempt->destination, 0, sizeof(attempt->destination));
}
