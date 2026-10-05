# Claude Themes

A Chrome extension that puts a background behind claude.ai, on the chat, cowork and code
screens, with frames and your own text colour and font.

- Six built-in gradient presets
- Upload your own images, then drag and zoom to crop each one to the shape of your screen
- Every image you save is kept, so you can switch between them without uploading again
- Image opacity slider, so a bright picture does not fight the text
- Sidebar opacity slider
- Borders: seven black ink frames (fineliner, double rule, draft lines, brush, sketch,
  hatching, Greek key), around the sidebar and the chat window separately or as one
  frame around everything
- Two pop-out frames, dark and pale, with sloping sides and a shadow, so the panels look
  raised off the page
- Text colour and font for the chat, for backgrounds that make the normal text hard to read
- Upload your own frame picture; its thickness is measured for you
- Works in light and dark mode

Unofficial. Not made by, or affiliated with, Anthropic. It restyles the page in your own
browser only. Your images are stored in Chrome on your computer and are not sent anywhere.

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
| `settings.js` | The default settings and the lists of backgrounds, frames and fonts |
| `content.js` | Runs on claude.ai, reads the saved settings, shows the background, frames and text style |
| `theme.css` | Styles the background layer, makes the page see-through, draws the frames, recolours the text |
| `popup.html`, `popup.js`, `popup.css` | The panel behind the toolbar icon: backgrounds, saved images, borders, text, on/off |
| `options.html`, `options.js`, `options.css` | The upload page: crop an image and add it to your saved images |
| `frame-upload.js` | The upload page: read and save your own frame picture |
