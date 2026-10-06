# Changelog

What changed in each version, newest first. Versions before 0.18.0 were made over two days
and are grouped.

## 0.18.0 (2026-10-05)

- An icon.
- Save the theme to a file, with its pictures, and load it again. Reset everything.
- A short note the first time the editor opens.
- Questions (remove a picture, reset) are asked inside the editor.
- If a chat page is not built the way the extension expects, the theme switches itself off
  there and the editor says so.
- Tests that say PASS or FAIL (`tests/run.mjs`), checks that need no browser
  (`tests/static.mjs`, run on every push), a privacy statement, and a script that makes the
  zip for the Chrome Web Store.

## 0.17.0 (2026-10-05)

- Pages that are not chats (Projects, Artifacts, Scheduled, Customize) are left as Claude
  draws them.

## 0.16.0 (2026-10-05)

- Drag the background, the sidebar's picture, and a side picture anywhere in the chat
  window.

## 0.13.0 to 0.15.0 (2026-10-05)

- A Zoom slider for the background and the sidebar's picture; the picture grows and shrinks
  around its middle.
- A landscape background is stretched to the exact size of the chat window, or of the whole
  window when the sidebar is joined to it.
- Nothing is blurred; messages fade out under the title bar.

## 0.12.1 (2026-10-05)

- The open chat shows as a see-through bubble on a customised sidebar.

## 0.9.0 to 0.12.0 (2026-10-05)

- The popup became an editor over the Claude page, with movable, resizable windows, drag
  and drop, undo and redo.
- Each side picture has its own size, height and opacity.

## 0.3.0 to 0.8.0 (2026-10-05)

- Saved images, animated GIF backgrounds, text colour, highlight colour and fonts.
- The sidebar set up separately from the main page.
- Pictures beside the chat, which can grow behind it.
- Borders became overlays that move nothing; the message box is left as Claude draws it.

## 0.1.0 and 0.2.0 (2026-10-04)

- Backgrounds with an opacity slider, six presets, image upload with cropping.
- Borders: ink frames, around the sidebar and the chat window or the whole window.
