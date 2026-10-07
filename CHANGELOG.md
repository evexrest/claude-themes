# Changelog

What changed in each version, newest first. Versions before 0.18.0 were made over two days
and are grouped.

## 0.21.0 (2026-10-06)

Pictures beside the chat fit any screen.

- A side picture's size and place are now shares of the empty space on its side of the
  chat, where they were pixels. That space is far narrower on a laptop than on a monitor,
  and with the sidebar open than shut, so a picture set up on a big screen covered the
  text on a small one. Now it takes up the same share of the space on every screen, and it
  cannot be over the chat on any of them.
- The Size slider reads as a percentage of the space, from 5% to 100%. A new picture
  starts at 80%, in the middle.
- Dragging a picture moves it within the empty space on its side and stops at both ends.
  Dragging its corner stops at the width of the space. A picture can no longer be made
  wider than the space or dragged behind the chat.
- Pictures set up in 0.20.0 or 0.20.1 are kept. One that fitted its space looks as it did.
  One that was wider than the space now fills it, and one dragged past the end of the
  space stops there.
- Such a picture is saved the new way the next time you resize it or move it sideways,
  as it looks in that window, and from then on it takes the same share of the space on
  every screen. Do that on the screen where it looks right. Until then it keeps its size
  in pixels wherever it fits and is held to the space wherever it does not. The editor
  says so under Place and size while such a picture is chosen.
- Theme files hold side pictures as they are saved. Files saved by earlier versions still
  load. An earlier version asked to load a new file says to update.

## 0.20.1 (2026-10-06)

A security pass before publishing.

- A theme file from someone else is held to exactly what the editor could have set: names
  from the editor's own lists, numbers within the sliders' ends, pictures in the one form
  the editor writes. Before, a file could set a border thick enough to cover the chat, or
  store a frame the page could not draw.
- A stored value that cannot be drawn no longer stops the rest of the theme on claude.ai.
  Each part is drawn on its own.
- The editor and the upload page are told by Chrome's own rules to load only files inside
  the extension, and they cannot fetch anything from another site. A link still opens its
  page when you click it.
- Reset everything keeps a frame you uploaded, as it keeps your saved pictures. So does
  loading a theme file that has no frame of its own. A file that has one replaces yours.
- A theme file holds the uploaded frame only when a border is set to it.
- The privacy statement says what claude.ai itself can see of a theme.
- Chrome 120 or newer is needed. The fade under the chat's title bar already needed it.
- `tools/package.sh` zips only files that git knows. It refuses if one of them has changes
  that are not committed, or if a script, page or stylesheet in the folder is not in git.

## 0.20.0 (2026-10-06)

- Several pictures on each side of the chat, where there was one. Click a side picture in
  the Library, or drop a file on a side, and it is added in front of the others, a step
  away from the last one so that it is not hidden behind it. The same picture can be added more than once. There can be 20 in all.
- Layers. The Left side and Right side settings show that side's pictures in a row, the one
  in front first. Bring forward, Send back, To the front and To the back move the chosen
  picture. Where pictures overlap on the page, a press picks up the one in front.
- Each picture has its own size, height, opacity and place. Click one on the page or in the
  row to choose it. The sliders and the Delete key work on the chosen one. Remove from the
  page takes it off and keeps it in the Library.
- A picture set up in an earlier version is still there, as it was left.
- Theme files hold the side pictures that are on the page and the order they are layered in. Files saved by
  earlier versions still load. An earlier version asked to load a new file says to update.
- The upload page's two buttons add the picture on a side. Each press adds one more.
- The button that made the other side's picture match is gone. So is swapping the picture
  in a place for another: take the one off and add the other.
- Chrome 111 or newer is needed, and the extension now says so. Its styles already
  needed it.

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
