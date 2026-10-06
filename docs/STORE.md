# Putting it on the Chrome Web Store

Everything the listing needs is here or made by a script. The steps at the end need the
owner of the project: an account, a one-time fee and a decision about the name.

## Decide first: the name

"Claude" is Anthropic's trademark. The store's rules do not allow a listing that could be
taken for the official product, and a name that begins with someone else's product name is
the usual reason for a rejection or a later takedown. The common pattern for unofficial
extensions is "<What it does> for <Product>", with a line saying it is unofficial.

- Safer: **Themes for Claude**
- As it is now: **Claude Themes**

This is a judgement about risk, not legal advice. To change it, edit `"name"` and
`"default_title"` in `manifest.json` and the headings in `editor.html`, then run the tests.
The description already says "Unofficial, not made by Anthropic".

## The listing

**Name.** See above.

**Summary** (132 characters at most; this is the manifest's description):

> Backgrounds, frames, side pictures, text colour and fonts for claude.ai. Unofficial, not made by Anthropic.

**Category.** Fun, or Accessibility if the text colour and font are the point. Fun fits.

**Language.** English.

**Description:**

> Make claude.ai yours. Put a picture, a GIF or a wash of colour behind your chats, give
> the sidebar a background of its own, add a border, drop characters into the empty space
> beside the chat, and choose the colour and font of the text.
>
> Everything is set up in an editor that opens right on top of the Claude page: click a
> part of the page, click a picture, and see it change. Drag pictures to move them. Undo
> takes back any step.
>
> - Backgrounds: six built in, or your own pictures and animated GIFs
> - Stretch, zoom and drag a background to fit the chat window or the whole window
> - A separate background, text colour, font and border for the sidebar
> - Pictures and GIFs beside the chat, each with its own size, place and opacity
> - Ink and pop-out borders that never move or resize anything
> - Save a whole theme to a file, with its pictures, to back it up or share it
> - Works in light and dark mode
>
> What it leaves alone: the message box, menus and code blocks keep Claude's own look, and
> pages that are not chats are shown as Claude draws them.
>
> Private by design: your pictures and settings stay in Chrome on your computer. The
> extension makes no connection to the internet and collects nothing.
>
> Unofficial. Not made by, or affiliated with, Anthropic.

**Screenshots** (1280 x 800). `tools/screenshots.sh` makes three in `docs/screenshots/`,
of the editor over a stand-in for a chat. The store will be better served by pictures of
the real thing: with the extension loaded, set up a theme you like on a chat with nothing
private in it, and take screenshots of the Claude window at 1280 x 800. Up to five.

**Icon.** `icons/icon-128.png`.

**Small promo tile** (440 x 280, optional). Not made yet.

## The privacy tab

- **Single purpose:** "Changes how claude.ai looks: backgrounds, borders, side pictures,
  text colour and fonts."
- **Permission: storage.** "Remembers the user's settings and pictures."
- **Permission: unlimitedStorage.** "Pictures and animated GIFs chosen by the user are
  larger than the default 10 MB allowance."
- **Host permission: claude.ai.** "The extension restyles this one site. It adds styles
  and the user's pictures to the page and opens its editor there."
- **Remote code:** No. All code is in the package.
- **Data use:** it collects none of the listed kinds of data. Tick the three statements
  (not sold, not used for unrelated purposes, not used for creditworthiness).
- **Privacy policy URL:** the address of `PRIVACY.md` on GitHub.

## The steps

1. Decide the name (above).
2. Run `tools/package.sh`. It makes `dist/claude-themes-<version>.zip`.
3. Go to the Chrome Web Store developer dashboard and sign in with the Google account that
   should own the listing. The first time, there is a one-time registration fee.
4. **New item**, and upload the zip.
5. Fill in the listing and the privacy tab from this page. Upload the screenshots.
6. Submit for review. Review usually takes a few days and can take longer for an extension
   that asks for a site's permission.

Each later version: bump the version in `manifest.json` and `settings.js`, run the tests,
run `tools/package.sh`, and upload the new zip to the same item. People who installed it
get the update on their own.
