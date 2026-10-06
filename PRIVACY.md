# Privacy

Claude Themes does not collect, send or share anything.

- **What it keeps.** Your settings and the pictures you add. They are kept in Chrome's own
  storage for extensions, on your computer.
- **Where it sends them.** Nowhere. The extension has no server and makes no connection to
  the internet. `tests/static.mjs` checks this on every change to the code.
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

Questions: open an issue on the project's GitHub page.

Last changed: 2026-10-05.
