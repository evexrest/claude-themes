#!/bin/zsh
# Makes dist/claude-themes-<version>.zip: the file to upload to the Chrome Web Store.
# Only what the extension needs goes in. Tests, tools and docs stay out.
R=${0:A:h:h}
cd $R
node tests/static.mjs || { print "Not packaged: the checks above failed."; exit 1 }
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
out=dist/claude-themes-$version.zip
rm -f $out
zip -q -X $out manifest.json LICENSE *.js *.html *.css icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
print "Made $out"
unzip -l $out | tail -n +4
