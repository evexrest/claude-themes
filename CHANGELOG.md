# Changelog

What changed in each version, newest first. Versions before 0.18.0 were made over two days
and are grouped.

## 0.20.0 (2026-10-06)

- Several pictures on each side of the chat, where there was one. Click a side picture in
  the Library, or drop a file on a side, and it is added in front of the others, a little
  higher up. The same picture can be added more than once. There can be 20 in all.
- Layers. The Left side and Right side settings show that side's pictures in a row, the one
  in front first. Bring forward, Send back, To the front and To the back move the chosen
  picture. Where pictures overlap on the page, a press picks up the one in front.
- Each picture has its own size, height, opacity and place. Click one on the page or in the
  row to choose it. The sliders and the Delete key work on the chosen one. Remove from the
  page takes it off and keeps it in the Library.
- A picture set up in an earlier version is still there, as it was left.
- Theme files hold every side picture and the order they are layered in. Files saved by
  earlier versions still load. An earlier version asked to load a new file says to update.
- The upload page's two buttons add the picture on a side. Each press adds one more.
- The button that made the other side's picture match is gone.

## 0.19.1 (2026-10-06)

- The Library no longer starts partly under the Settings window, so every theme shows.
- A change Chrome refuses to store now goes back to the stored value even while a slider
  is still moving.
- The readability warning gives advice that fits a picture with both light and dark
  areas at full opacity.
- The cross on a saved picture has a name a screen reader can say.

## 0.19.0 (2026-10-06)

- Nine ready-made themes at the top of the Library. One click switches the whole look.
  Your saved pictures are kept, and Undo takes the switch back.
- Four new backgrounds: Midnight, Paper, Mist and Blossom.
- A warning under the text colours when the text is hard to read on the background, in
  Claude's light mode, its dark mode or both. A button fixes it when one colour reads in
  both.
- A keyboard shortcut for the editor: Alt+Shift+E, or Option+Shift+E on a Mac. Change it
  at `chrome://extensions/shortcuts`.
- Every button, slider and choice in the editor can be reached with Tab and has a name
  a screen reader can say. Choices say whether they are on, and the keyboard's place is
  ringed. Dragging a picture or a window still needs a mouse.
- A question such as "Remove this picture?" starts on Cancel, so Enter never removes
  anything.
- If Chrome cannot store a change, the editor puts the change back and says so.
- The foot of the Library shows the version and links to the issue page and the privacy
  statement.

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
