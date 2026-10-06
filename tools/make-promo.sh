#!/bin/zsh
# Makes docs/promo-440x280.png, the small tile the Chrome Web Store shows beside the
# listing: the icon, the name and one line, on the Dusk background. Uses the Chrome on
# this Mac, headless, with a throwaway profile. Run it again after changing icon.svg
# or the name in manifest.json.
R=${0:A:h:h}
P=$R/tools/.profile-promo-$$
page=$R/tools/.promo.html
name=$(python3 -c "import json; print(json.load(open('$R/manifest.json'))['name'])")
print "<!doctype html><meta charset=\"utf-8\"><style>
html,body{margin:0}
body{width:440px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  background:radial-gradient(circle at 15% 20%, rgba(255,190,150,.35), transparent 45%), linear-gradient(135deg,#1f3a5f,#7b3f61 55%,#d97757);
  color:#fff;font-family:system-ui,sans-serif;text-align:center}
img{width:96px;height:96px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
b{font-size:30px;letter-spacing:-.3px}
span{font-size:15px;opacity:.92}
</style><img src=\"file://$R/icons/icon.svg\"><b>$name</b><span>Backgrounds, borders and fonts for claude.ai</span>" > $page
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$P --hide-scrollbars --force-device-scale-factor=1 --window-size=440,280 --screenshot=$R/docs/promo-440x280.png "file://$page" >/dev/null 2>&1 &
pid=$!
for i in {1..30}; do sleep 0.3; kill -0 $pid 2>/dev/null || break; done
kill $pid 2>/dev/null; sleep 0.2
ps -axo pid,command | grep "user-data-dir=$P" | grep -v grep | awk '{print $1}' | xargs kill 2>/dev/null
rm -rf $P $page
ls -la $R/docs/promo-440x280.png
