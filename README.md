# Claude Themes

A Chrome extension that puts a background behind claude.ai, on the chat, cowork and code
screens.

- Six built-in gradient presets
- Upload your own image, then drag and zoom to crop it to the shape of your screen
- Image opacity slider, so a bright picture does not fight the text
- Sidebar opacity slider
- Borders: seven black ink frames (fineliner, double rule, draft lines, brush, sketch,
  hatching, Greek key), around the sidebar and the chat window separately or as one
  frame around everything
- Upload your own frame picture; its thickness is measured for you
- Works in light and dark mode

Unofficial. Not made by, or affiliated with, Anthropic. It restyles the page in your own
browser only. Your image is stored in Chrome on your computer and is not sent anywhere.

**Status: early.** It can break when claude.ai changes its layout. If something looks
wrong, turn it off with the **On** switch and open an issue.

## Install

1. Download this repository (green **Code** button, then **Download ZIP**) and unzip it.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Open claude.ai. The Dusk preset shows straight away.
6. Click the puzzle-piece icon in the toolbar, then **Claude Themes**, to change it.

It also works in other Chromium browsers such as Edge, Brave and Arc.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Tells Chrome what the extension is and which pages it runs on |
| `settings.js` | The default settings and the lists of background and frame presets |
| `content.js` | Runs on claude.ai, reads the saved settings, shows the background |
| `theme.css` | Styles the background layer, makes the page see-through, draws the frames |
| `popup.html`, `popup.js`, `popup.css` | The panel behind the toolbar icon: backgrounds, borders, sliders, on/off |
| `options.html`, `options.js`, `options.css` | The upload page: crop a background image |
| `frame-upload.js` | The upload page: read and save your own frame picture |
