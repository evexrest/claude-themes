#!/bin/zsh
# Draws icons/icon.svg at the four sizes Chrome asks for, as PNGs with a see-through
# background. Uses the Chrome on this Mac, headless, with a throwaway profile; the
# Chrome you have open is not touched. Run it again after changing icon.svg.
R=${0:A:h:h}
P=$R/tools/.profile-icons-$$
for size in 16 32 48 128; do
  page=$R/tools/.icon-$size.html
  print "<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src=\"file://$R/icons/icon.svg\">" > $page
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$P --hide-scrollbars --default-background-color=00000000 --force-device-scale-factor=1 --window-size=$size,$size --screenshot=$R/icons/icon-$size.png "file://$page" >/dev/null 2>&1 &
  pid=$!
  for i in {1..30}; do sleep 0.3; kill -0 $pid 2>/dev/null || break; done
  kill $pid 2>/dev/null; sleep 0.2
  ps -axo pid,command | grep "user-data-dir=$P" | grep -v grep | awk '{print $1}' | xargs kill 2>/dev/null
  rm -f $page
done
rm -rf $P
ls -la $R/icons
