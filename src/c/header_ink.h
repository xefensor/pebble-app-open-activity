#pragma once

#include <stdbool.h>
#include "generated_header_ink.h"

/* Setup has fixed English strings, clock digits and a fitted UTF-8 ellipsis.
 * Unknown characters use the same measured wildcard as the renderer. */
static inline OaGlyphInk oa_header_ink(const char *text, bool custom) {
  OaGlyphInk result={127,0};
  for(const unsigned char *p=(const unsigned char *)text;*p;) {
    unsigned index=96;
    if(*p>=32&&*p<=126)index=*p++-32;
    else if(p[0]==0xe2&&p[1]==0x80&&p[2]==0xa6){index=95;p+=3;}
    else {++p;while((*p&0xc0)==0x80)++p;}
    const OaGlyphInk glyph=oa_header_glyphs[custom?0:1][index];
    if(glyph.top==127)continue;
    if(glyph.top<result.top)result.top=glyph.top;
    if(glyph.bottom>result.bottom)result.bottom=glyph.bottom;
  }
  if(result.top==127)result.top=result.bottom=0;
  return result;
}
