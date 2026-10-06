# Contributing

Bug reports and fixes are welcome.

**Reporting a problem.** Open an issue and say which page you were on (a chat, the new-chat
page, Projects), light or dark mode, whether the sidebar was open, and the version number
on `chrome://extensions`. A screenshot helps most; crop out anything private.

**Changing the code.**

1. There is nothing to install or build. Load the folder in Chrome (see the README).
2. Run `node tests/static.mjs` and `node tests/run.mjs` before and after. The second needs
   a Mac with Chrome.
3. If a result changes on purpose, look it over, then run `node tests/run.mjs --update` and
   commit the new `tests/expected/` with the change.
4. Bump the version in **both** `manifest.json` and `settings.js`, and add a line to
   `CHANGELOG.md`.

**Rules the extension keeps.** Please keep to them:

- Nothing on the page is moved, resized or made to behave differently. Borders and pictures
  are drawn over or under the page.
- The message box, menus and code blocks keep Claude's own look.
- Nothing is sent anywhere. `tests/static.mjs` fails if code starts talking to the internet.
- The stand-in pages in `tests/` are not claude.ai. Anything that measures the page is
  tried on the real site before it is released.
