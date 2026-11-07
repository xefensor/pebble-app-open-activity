#pragma once

#include <stdbool.h>
#include "generated_header_ink.h"

/* The custom header measures every translated title glyph. Unknown stock-font
 * characters retain the recorded SDK wildcard fallback. */
static inline OaGlyphInk oa_header_ink(const char *text, bool custom) {
  OaGlyphInk result={127,0};
  for(const unsigned char *p=(const unsigned char *)text;*p;) {
    uint32_t code=*p++;
    if(code>=0xc2&&code<0xe0&&(*p&0xc0)==0x80){code=((code&31)<<6)|(*p++&63);}
    else if(code>=0xe0&&code<0xf0&&p[0]&&p[1]&&(p[0]&0xc0)==0x80&&(p[1]&0xc0)==0x80){code=((code&15)<<12)|((p[0]&63)<<6)|(p[1]&63);p+=2;}
    unsigned index=code>=32&&code<=126?code-32:code==0x2026?95:96;
    OaGlyphInk glyph=oa_header_glyphs[custom?0:1][index];
    if(custom&&index==96)for(unsigned i=0;i<sizeof(oa_header_extra)/sizeof(*oa_header_extra);++i)if(oa_header_extra[i].code==code)glyph=oa_header_extra[i].ink;
    if(glyph.top==127)continue;
    if(glyph.top<result.top)result.top=glyph.top;
    if(glyph.bottom>result.bottom)result.bottom=glyph.bottom;
  }
  if(result.top==127)result.top=result.bottom=0;
  return result;
}
