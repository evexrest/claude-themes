# Tests

These check the extension without loading it into Chrome. They run the real
`settings.js`, `content.js`, `theme.css`, `popup.js` and `options.js` in a separate,
throwaway headless Chrome, with a stand-in for Chrome's storage (`stub.js`). The Chrome
you have open is never touched.

Run from the project folder:

| Command | What it checks |
|---|---|
| `python3 tests/build.py` | Makes the popup and upload test pages. Run it first, and again after changing `popup.html` or `options.html` |
| `tests/dump.sh logic 14000` | The page script and stylesheet: backgrounds, sidebar, frames, text, side pictures |
| `tests/dump.sh popup-logic` | Every area and tab of the popup, and that main-page and sidebar settings change separately |
| `tests/dump.sh options-logic` | Uploading a GIF and a still image, for the main page and the sidebar |
| `tests/shot.sh popups 1480 1250` | A picture of every popup tab, saved as `tests/popups.png` |
| `node tests/cdp.mjs "file://$PWD/tests/page.html?bg=image&gif=1&f=none&o=1" /tmp/ct-profile` | Whether a GIF background moves: several real-time captures, counted |

Each `dump.sh` run prints its results as JSON. There is no pass or fail line yet: read the
values. `page.html` is a stand-in for claude.ai's layout that takes its settings from the
address, for pictures; `logic.html` runs a fixed script.

`gif.py` writes the two test characters (`char.gif`, `char2.gif`); `gifs.js` holds them as
text for the test pages.

These pages copy claude.ai's class names as they were on 2026-10-05. They show that the
extension's own code works, not that claude.ai still looks the way the pages assume.
