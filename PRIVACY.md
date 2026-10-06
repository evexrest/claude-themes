# Privacy

Claude Themes does not collect, send or share anything.

- **What it keeps.** Your settings and the pictures you add. They are kept in Chrome's own
  storage for extensions, on your computer.
- **Where it sends them.** Nowhere. The extension has no server and makes no connection to
  the internet. Two things hold it to that. Chrome is told that the extension's own pages
  (the editor and the upload page) may load only files that are inside the extension, so
  they cannot contact another site even by mistake. And `tests/static.mjs` looks through
  the code for addresses and for ways of calling out on every change. That second check
  reads the code as text, so it is a safeguard and not a proof.
- **What claude.ai can see.** Your pictures, colours and fonts are drawn into the claude.ai
  page. That is how a theme works, and it means the site's own scripts could look at them,
  and could tell that this extension is installed. The extension itself passes them
  nothing else.
- **Links.** The editor has three links: Open Claude, Report a problem and Privacy. Clicking
  one opens that page in a tab, as any link does. Nothing is opened unless you click.
- **What it can see.** It runs only on `claude.ai`, where it adds its styles and pictures to
  the page. It does not read your conversations, your account or anything you type.
- **No tracking.** No analytics, no advertising, no accounts.
- **Theme files.** "Save to a file" writes a file to your own computer, holding your
  settings and the pictures in use. It goes only where you put it.
- **Removing it.** Removing the extension from Chrome removes everything it kept.

The permissions it asks for, and why:

| Permission | Why |
|---|---|
| `storage` | To remember your settings and pictures |
| `unlimitedStorage` | Pictures and GIFs are large; Chrome's usual allowance is 10 MB |
| `https://claude.ai/*` | To restyle that site, which is the whole purpose, and no other |

A theme file from someone else can only set what the editor itself could have set: every
value in it is checked against the editor's own choices and limits, and its pictures must
be pictures. It cannot run code.

Questions: open an issue on the project's GitHub page.

Last changed: 2026-10-06.
