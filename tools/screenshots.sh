#!/bin/zsh
# Makes the pictures in docs/screenshots/ (1280 x 800, the size the Chrome Web Store
# asks for) from the editor's own test page, in a throwaway headless Chrome. They
# show the editor over the stand-in for a Claude chat, not a real conversation.
R=${0:A:h:h}
python3 $R/tests/build.py >/dev/null
shot() { # name, then the settings for the test page
  $R/tests/shot.sh editor-test 1280 800 "shots=1&$2" >/dev/null 2>&1
  cp $R/tests/editor-test.png $R/docs/screenshots/$1.png
}
shot editor-main    "part=main&light=1&preset=ocean&frame=brush"
shot editor-sidebar "part=sidebar&dark=1&preset=aurora&side=own"
shot editor-side    "part=left&light=1&preset=ember&size=220"
ls -la $R/docs/screenshots
