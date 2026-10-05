#!/bin/zsh
# usage: tests/dump.sh name [virtual-ms [query]]
# Runs tests/name.html in a throwaway headless Chrome and prints the results the
# page wrote into its <pre id="out">. Never touches the Chrome you have open.
T=${0:A:h}
P=$T/.profile-$1-$$
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$P --window-size=1512,900 --virtual-time-budget=${2:-9000} --dump-dom "file://$T/$1.html${3:+?$3}" > $T/$1.dom 2>/dev/null &
pid=$!
for i in {1..50}; do sleep 0.5; grep -q "END</pre>" $T/$1.dom 2>/dev/null && break; kill -0 $pid 2>/dev/null || break; done
sleep 0.5; kill $pid 2>/dev/null; sleep 0.3
ps -axo pid,command | grep "user-data-dir=$P" | grep -v grep | awk '{print $1}' | xargs kill -9 2>/dev/null
rm -rf $P
python3 - "$T/$1.dom" <<'PY'
import html, sys
d = open(sys.argv[1]).read()
i = d.find('<pre id="out">RESULT'); j = d.find('END</pre>', i)
print(html.unescape(d[i + 20:j]) if i >= 0 and j >= 0 else 'NO RESULT; dom bytes: %d' % len(d))
PY
