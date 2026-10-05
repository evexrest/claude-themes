#!/bin/zsh
# usage: tests/shot.sh name [width height [query]]
# Renders tests/name.html to tests/name.png in a throwaway headless Chrome. `query` is
# added to the address, for pages that read their settings from it: "part=left&dark=1".
T=${0:A:h}
P=$T/.profile-$1-$$
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --allow-file-access-from-files --user-data-dir=$P --hide-scrollbars --window-size=${2:-1400},${3:-1380} --virtual-time-budget=3000 --screenshot=$T/$1.png "file://$T/$1.html${4:+?$4}" >/dev/null 2>&1 &
pid=$!
for i in {1..40}; do sleep 0.5; kill -0 $pid 2>/dev/null || break; done
kill $pid 2>/dev/null; sleep 0.3
ps -axo pid,command | grep "user-data-dir=$P" | grep -v grep | awk '{print $1}' | xargs kill 2>/dev/null
rm -rf $P
ls -la $T/$1.png
