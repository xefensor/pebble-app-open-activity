#!/usr/bin/env python3
"""Build separate locale lookup and opening launch-reason fixtures for QEMU."""
from pathlib import Path
import json,shutil,subprocess
from repo_workflow import candidate,check_build

root=Path(__file__).resolve().parents[1]
check_build(root,candidate(root,'Open-Activity'))
output=root/'build/qa/native-reference';project=output/'project'
project.mkdir(parents=True,exist_ok=True)
for directory in ('src','resources','vendor','node_modules'):
    shutil.copytree(root/directory,project/directory,dirs_exist_ok=True)
for name in ('package.json','package-lock.json','wscript'):
    shutil.copyfile(root/name,project/name)
for locale in ('en_US','cs_CZ','de_DE'):
    for opening in (False,True):
        if locale=='en_US' and not opening:continue
        source=(root/'src/c/localization.c').read_text().replace('i18n_get_system_locale()',json.dumps(locale))
        (project/'src/c/localization.c').write_text(source)
        main=(root/'src/c/main.c').read_text()
        if opening:
            main=main.replace('AppLaunchReason reason = launch_reason();','AppLaunchReason reason = APP_LAUNCH_QUICK_LAUNCH;')
            main=main.replace('s_gesture = launch_get_quick_launch_action();','s_gesture = APP_QUICK_LAUNCH_ACTION_HOLD;')
            main=main.replace('s_button = launch_button();','s_button = BUTTON_ID_DOWN;')
        (project/'src/c/main.c').write_text(main)
        subprocess.run(['pebble','clean'],cwd=project,check=True)
        subprocess.run(['pebble','build'],cwd=project,check=True)
        shutil.copyfile(project/'build/project.pbw',output/(('opening-' if opening else 'setup-')+locale[:2]+'.pbw'))
print(output)
