# Claude Themes

A Chrome extension that puts a background behind claude.ai, on the chat, cowork and code
screens, with frames and your own text colour and font.

- Six built-in gradient presets
- Upload your own images, then drag and zoom to crop each one to the shape of your screen
- Every image you save is kept, so you can switch between them without uploading again
- A GIF can be a background too, for the page or the sidebar, and keeps moving. GIFs are
  saved whole, not cropped
- Image opacity slider, so a bright picture does not fight the text
- Sidebar opacity slider
- Borders: seven black ink frames (fineliner, double rule, draft lines, brush, sketch,
  hatching, Greek key), around the sidebar and the chat window separately or as one
  frame around everything
- Two pop-out frames, dark and pale, with sloping sides and a shadow, for a raised, 3D look
- Frames lie over the edge of the page. They never move or resize anything
- The main page and the sidebar are set up separately: each has its own background, text
  colour, font, frame and frame thickness
- The sidebar can share the main background, have a picture of its own with its own
  opacity, or stay exactly as Claude draws it
- Pictures or GIFs in the empty space on either side of the chat, with size, height and
  opacity sliders. They work with any background, including Claude's own, and never sit
  on top of the chat
- Text colour and font for the chat, for backgrounds that make the normal text hard to
  read, and a separate colour for the words Claude marks out (normally crimson)
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
| `content.js` | Runs on claude.ai, reads the saved settings, shows the background, the sidebar's picture, the side pictures, frames and text style |
| `theme.css` | Styles the picture layers, makes the page see-through, draws the frames, recolours the text |
| `popup.html`, `popup.js`, `popup.css` | The panel behind the toolbar icon: backgrounds, saved images, sidebar, side pictures, borders, text, on/off |
| `options.html`, `options.js`, `options.css` | The upload page: crop an image for the screen or the sidebar and add it to your saved images |
| `frame-upload.js` | The upload page: read and save your own frame picture |
| `stickers.js` | The upload page: save a picture or GIF for beside the chat |
