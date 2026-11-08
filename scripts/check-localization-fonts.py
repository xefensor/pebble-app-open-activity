#!/usr/bin/env python3
"""Check native locale resource identity; system glyphs belong to the OS."""
from pathlib import Path
import argparse,json,struct,zipfile
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--pbw',type=Path,required=True);args=parser.parse_args()
package=json.loads((root/'package.json').read_text());data=json.loads((root/'src/common/translations.json').read_text())
with zipfile.ZipFile(args.pbw) as archive:packed=archive.read('emery/app_resources.pbpack')
locale_index=next(i for i,item in enumerate(package['pebble']['resources']['media']) if item['name']=='LOCALIZATION')
_,offset,size,_=struct.unpack_from('<4I',packed,12+locale_index*16)
assert packed[4108+offset:4108+offset+size]==(root/'resources/localization.bin').read_bytes(), 'Packaged native locale resource differs'
assert not any(item['type']=='font' for item in package['pebble']['resources']['media']), 'Native setup must use OS fonts'
print(str(len(data['languages']))+' native locale resources verified; OS glyph rendering/fallback is checked separately in the emulator.')
