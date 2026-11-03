#include <assert.h>
#include <stdio.h>
#include <string.h>

#include "../src/c/attempt.h"

static const char *TIMER = "50e9ef12-a5ab-4369-a3b5-3447bfba5151";
static const char *MUSIC = "1f03293d-47af-4f28-b960-f2b02a6dd757";

int main(void) {
  OaAttempt attempt;
  oa_attempt_init(&attempt, 42, 1000);
  assert(oa_attempt_current(&attempt, 42, 4999));
  assert(!oa_attempt_current(&attempt, 41, 1001));
  assert(!oa_attempt_current(&attempt, 42, 5000));
  assert(!oa_attempt_prepare(&attempt, 42, 0, OA_PRIMARY, TIMER, 1001));
  assert(!oa_attempt_prepare(&attempt, 42, 9, 0, TIMER, 1001));
  assert(!oa_attempt_prepare(&attempt, 41, 9, OA_PRIMARY, TIMER, 1001));
  assert(oa_attempt_prepare(&attempt, 42, 9, OA_SECONDARY, TIMER, 2000));
  assert(attempt.phase == OA_CONFIRMED && attempt.ticket == 9 && attempt.role == OA_SECONDARY);
  assert(strcmp(attempt.destination, TIMER) == 0);
  assert(!oa_attempt_prepare(&attempt, 42, 9, OA_PRIMARY, MUSIC, 2001));
  assert(strcmp(attempt.destination, TIMER) == 0);
  oa_attempt_close(&attempt);
  assert(!oa_attempt_current(&attempt, 42, 2002));
  assert(attempt.ticket == 0 && attempt.destination[0] == '\0');
  assert(!oa_attempt_prepare(&attempt, 42, 10, OA_PRIMARY, MUSIC, 2002));

  oa_attempt_init(&attempt, 99, UINT32_MAX - 999u);
  assert(oa_attempt_elapsed(&attempt, 0) == 1000);
  assert(oa_attempt_current(&attempt, 99, 2999));
  assert(!oa_attempt_current(&attempt, 99, 3000));
  oa_attempt_init(&attempt, 0, 0);
  assert(attempt.phase == OA_CLOSED);

  assert(oa_destination_valid(TIMER));
  assert(oa_destination_valid(MUSIC));
  assert(!oa_destination_valid(NULL));
  assert(!oa_destination_valid(""));
  assert(!oa_destination_valid("00000000-0000-0000-0000-000000000000"));
  assert(!oa_destination_valid(OA_HELPER_UUID));
  assert(!oa_destination_valid("50E9EF12-a5ab-4369-a3b5-3447bfba5151"));
  assert(!oa_destination_valid("50e9ef12-a5ab-4369-a3b5-3447bfba515"));
  assert(!oa_destination_valid("50e9ef12-a5ab-4369-a3b5-3447bfba51511"));
  puts("native attempt: liveness, roles, duplicate prepare, closure, wrap and destinations passed");
  return 0;
}
