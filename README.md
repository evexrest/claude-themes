# Claude Themes

A Chrome extension that puts a background behind claude.ai, on the chat, cowork and code
screens, with frames and your own text colour and font.

The toolbar icon opens an editor right on top of the Claude page. Its three windows (a
bar, the library and the settings) float over the page like windows on a desktop: drag one
by its title bar to move it, drag an edge or a corner to resize it, and use the three dots
to close it, fold it away or put it back. They stay where you leave them. The page itself
is the canvas: click a part of it (the main page, the
sidebar, or the space on either side of the chat) to change that part, and drag pictures
onto it from your computer or from the library. Every change shows on
the real page as you make it. A side picture can be dragged up and down and resized by its
corner. Undo and redo work as in any editor. **Done**, Esc, or the toolbar icon again
closes it.

Clicked on another tab, the icon goes to your Claude tab, or opens one.

- Six built-in gradient presets
- Drop your own images onto the editor, or upload one with cropping: drag and zoom to
  choose the part that shows
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
- A landscape background is stretched to the exact size of its space: the chat window,
  or the whole window when the sidebar is joined to it. The editor shows that size. An
  upright picture fills the page instead
- A Zoom slider for the background image and for the sidebar's picture, for keeping the
  picture's own shape: from the whole picture, with nothing cut off, through filling the
  space, up to four times that. The picture grows and shrinks around its middle and
  never slides. The crop tool on the upload page zooms out to the whole picture as well
- Drag to move: the background image on the page, the sidebar's picture on the sidebar,
  and a side picture anywhere in the chat window. A button puts each back
- The main page's theme is for chats. Claude's other pages (Projects, Artifacts,
  Scheduled, Customize and so on) are left exactly as Claude draws them; the sidebar keeps
  its own picture and text colour there
- Nothing on the page is blurred. Messages fade out as they reach the title bar
- Pictures or GIFs in the empty space on either side of the chat. Each side has its own
  size, height and opacity. They work with any background, including Claude's own. A picture
  bigger than the empty space carries on behind the chat, never on top of it
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
6. Click the puzzle-piece icon in the toolbar, then **Claude Themes**, to open the editor
   over the page.

It also works in other Chromium browsers such as Edge, Brave and Arc.

## Files

| File | What it does |
|---|---|
| `manifest.json` | Tells Chrome what the extension is and which pages it runs on |
| `settings.js` | The default settings and the lists of backgrounds, frames and fonts |
| `content.js` | Runs on claude.ai, reads the saved settings, shows the background, the sidebar's picture, the side pictures, frames and text style, and lays the editor over the page |
| `theme.css` | Styles the picture layers, makes the page see-through, draws the frames, recolours the text |
| `background.js` | Tells the Claude tab to open or close the editor when the toolbar icon is clicked |
| `editor.html`, `editor.js`, `editor.css` | The editor: the library of pictures, the parts you click and drop onto, and the settings of the selected part. `content.js` shows it in a see-through frame over the page |
| `preview.html`, `preview.css` | A stand-in for the Claude page, for when the editor has to open in a tab of its own (a Claude tab that has not been refreshed since the extension was reloaded). It uses claude.ai's class names, so `theme.css` and `content.js` style it exactly as they style the real page |
| `options.html`, `options.js`, `options.css` | The upload page, opened from the editor: crop an image for the screen or the sidebar and add it to your saved images |
| `frame-upload.js` | The upload page: read and save your own frame picture |
| `stickers.js` | The upload page: save a picture or GIF for beside the chat |
| `tests/` | Checks that run the extension's code in a separate, throwaway Chrome. See `tests/README.md` |

## Licence

MIT. See `LICENSE`.
