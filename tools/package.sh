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
# Only files git knows, so nothing left lying in the folder is shipped, and only as
# they were committed, so the zip is the same as what is on GitHub.
files=($(git ls-files -- manifest.json LICENSE ':(glob)*.js' ':(glob)*.html' ':(glob)*.css' icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png))
stray=$(git ls-files --others --exclude-standard -- ':(glob)*.js' ':(glob)*.html' ':(glob)*.css')
[[ -z $stray ]] || { print "Not packaged: these files are in the folder but git does not know them. Add them or remove them:\n$stray"; exit 1 }
git diff --quiet HEAD -- $files || { print "Not packaged: some of the extension's files have changes that are not committed."; exit 1 }
zip -q -X $out $files
print "Made $out"
unzip -l $out | tail -n +4
