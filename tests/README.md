# Tests

These check the extension in a separate, throwaway headless Chrome. The Chrome you have
open is never touched. Most of them run the real `settings.js`, `content.js`, `theme.css`,
`editor.js` and `options.js` as ordinary pages, with a stand-in for Chrome's storage
(`stub.js`). `real.mjs` loads the folder as an extension, the way Chrome will.

Run from the project folder:

| Command | What it checks |
|---|---|
| `python3 tests/build.py` | Makes the editor and upload test pages. Run it first, and again after changing `editor.html`, `preview.html` or `options.html` |
| `tests/dump.sh logic 14000` | The page script and stylesheet: backgrounds, sidebar, frames, text, side pictures |
| `tests/dump.sh editor-logic 20000` | The editor in a tab of its own: selecting parts, the library, dropping files, dragging pictures, moving and resizing a side picture, undo and redo, every setting, the toolbar icon |
| `tests/dump.sh editor-page-logic 12000 "on=page"` | The editor as it runs over the real page: its parts follow the page's measurements, the windows move, resize, fold, close and go back, and get out of the way of a drag; Done and Esc close it |
| `tests/dump.sh options-logic` | Uploading a GIF and a still image, for the main page and the sidebar |
| `tests/shot.sh editor-test 1512 900 "part=left&dark=1"` | A picture of the editor, saved as `tests/editor-test.png`. The last part is optional: `part=` selects a part, `dark=1` the dark preview, `drag=files` shows the drop areas |
| `node tests/real.mjs` | The real thing: loads the folder as an extension and clicks the toolbar icon on a Claude tab, on another tab, and with no Claude tab open; in the editor it changes a setting, drops a picture and checks the page underneath follows, then moves and resizes a window with the mouse itself. It never visits claude.ai: a small server on this computer stands in for it. Saves `tests/real-page.png`, `tests/real-page-dark.png` and `tests/real-page-windows.png` |
| `node tests/cdp.mjs "file://$PWD/tests/page.html?bg=image&gif=1&f=none&o=1" /tmp/ct-profile` | Whether a GIF background moves: several real-time captures, counted |

Each `dump.sh` run prints its results as JSON. There is no pass or fail line yet: read the
values. `page.html` is a stand-in for claude.ai's layout that takes its settings from the
address, for pictures; `logic.html` runs a fixed script.

`gif.py` writes the two test characters (`char.gif`, `char2.gif`); `gifs.js` holds them as
text for the test pages.

On claude.ai the page area (`.dframe-content`) is the whole window and the sidebar stands
on top of it. The stand-ins are built the same way since 0.14.0; before that theirs sat
beside the sidebar, and code that measured it passed here and was wrong on the real site.

These pages copy claude.ai's class names as they were on 2026-10-05. They show that the
extension's own code works, not that claude.ai still looks the way the pages assume.
