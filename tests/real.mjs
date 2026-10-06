// Load the extension itself, as Chrome will, into a throwaway headless Chrome, and
// use it the way a person would: click the toolbar icon on a Claude tab, change
// things in the editor that opens over the page, drop a picture, close it. This is
// the only check that uses Chrome's real extension system (the manifest, the
// toolbar-icon script, real storage, a frame from the extension on a web page).
//
// It never goes to the real claude.ai. A small server on this computer stands in for
// it: Chrome is told that claude.ai lives here, and is served the editor's own
// stand-in page with the same rules about frames that claude.ai sends.
//
// usage: node tests/real.mjs
// Prints what it found as JSON and saves pictures as tests/real-*.png.
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { createServer } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const tests = dirname(fileURLToPath(import.meta.url));
const project = resolve(tests, "..");
const profile = resolve(tests, ".profile-real-" + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(profile, { recursive: true });

// ----- the stand-in for claude.ai -----
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=claude.ai",
  "-addext", "subjectAltName=DNS:claude.ai", "-keyout", resolve(profile, "key.pem"), "-out", resolve(profile, "cert.pem")], { stdio: "ignore" });
// The editor's stand-in page, as a plain web page: the extension adds its own stylesheet and script.
const standIn = readFileSync(resolve(project, "preview.html"), "utf8")
  .replace('<link rel="stylesheet" href="theme.css">', "").replace(/<script src="[^"]+"><\/script>/g, "").replace('href="preview.css"', 'href="/preview.css"');
// The rules claude.ai sent about frames and scripts on 2026-10-05, shortened.
const rules = "script-src 'nonce-x' 'strict-dynamic'; object-src 'none'; base-uri 'none'; img-src 'self' data: blob:; frame-src 'self' a.claude.ai js.stripe.com";
const server = createServer({ key: readFileSync(resolve(profile, "key.pem")), cert: readFileSync(resolve(profile, "cert.pem")) }, (request, answer) => {
  if (request.url === "/preview.css") { answer.writeHead(200, { "content-type": "text/css" }); answer.end(readFileSync(resolve(project, "preview.css"))); return; }
  answer.writeHead(200, { "content-type": "text/html", "content-security-policy": rules, "cross-origin-opener-policy": "same-origin-allow-popups", "cross-origin-resource-policy": "same-origin" });
  answer.end(standIn);
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const port = server.address().port;

// Chrome is driven through a pipe, which is what lets a folder be loaded as an extension.
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging",
    `--host-resolver-rules=MAP claude.ai 127.0.0.1:${port}`, "--ignore-certificate-errors",
    `--user-data-dir=${profile}`, "--window-size=1512,900", "about:blank"],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });

let id = 0; let buffer = "";
const waiting = new Map(); const events = [];
chrome.stdio[4].on("data", (chunk) => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); } else events.push(message);
  }
});
const send = (method, params = {}, sessionId) => new Promise((done) => {
  waiting.set(++id, (message) => done(message.error ? { error: message.error.message } : message.result));
  chrome.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + "\0");
});
const attach = async (targetId) => {
  const session = (await send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
  await send("Runtime.enable", {}, session); await send("Log.enable", {}, session);
  return session;
};
const run = async (session, expression) => {
  const out = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, session);
  return out.error || (out.exceptionDetails ? "threw: " + (out.exceptionDetails.exception?.description || out.exceptionDetails.text) : out.result.value);
};
const targets = async () => (await send("Target.getTargets")).targetInfos;
// Anything the extension saves as a file goes into the throwaway folder, not the real Downloads.
const downloads = resolve(profile, "saved-files"); mkdirSync(downloads, { recursive: true });
await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
const picture = async (session, name) => { const shot = await send("Page.captureScreenshot", { format: "png" }, session); if (shot.data) writeFileSync(resolve(tests, name), Buffer.from(shot.data, "base64")); };

const found = {};
try {
  await sleep(1500);
  const loaded = await send("Extensions.loadUnpacked", { path: project });
  found.loaded = loaded.error || "yes";
  const base = `chrome-extension://${loaded.id}/`;
  await sleep(1500);

  const worker = (await targets()).find((t) => t.type === "service_worker" && t.url.startsWith(base));
  found.iconScript = worker ? worker.url.slice(base.length) : "not running";
  const icon = await attach(worker.targetId);
  // The keys Chrome really gave the toolbar icon, from the manifest's suggestion.
  found.shortcut = await run(icon, `chrome.commands.getAll().then((all) => all.map((c) => c.name + " = " + c.shortcut).join(", "))`);
  // Click the toolbar icon while a given tab is the one in front.
  const clickIconOn = (which) => run(icon, `(async () => { const tabs = await chrome.tabs.query({}); const claudeTab = (t) => (t.url || t.pendingUrl || "").startsWith("https://claude.ai/"); const tab = tabs.find((t) => ${JSON.stringify(which)} === "claude" ? claudeTab(t) : !claudeTab(t)); if (!tab) return "no such tab"; await chrome.tabs.update(tab.id, { active: true }); chrome.action.onClicked.dispatch(tab); return "clicked"; })()`);
  const editorFrames = async () => (await targets()).filter((t) => t.url.startsWith(base + "editor.html?on=page")).length;

  // What a version before 0.20.0 left in storage: one picture for the left side, in the old settings, and no list of pictures.
  found.anEarlierVersionsSettings = await run(icon, `(async () => { const c = new OffscreenCanvas(120, 150), x = c.getContext("2d"); x.fillStyle = "#2f6b3f"; x.beginPath(); x.arc(60, 75, 55, 0, 7); x.fill();
    const blob = await c.convertToBlob({ type: "image/png" }); const data = await new Promise((ok) => { const reader = new FileReader(); reader.onload = () => ok(reader.result); reader.readAsDataURL(blob); });
    await chrome.storage.local.set({ stickers: [{ id: "old", thumb: data }], "sticker-old": data, stickerLeft: "old", stickerLeftSize: 140, stickerPosition: 30, stickerOpacity: 0.9 }); return "saved"; })()`);
  // The pictures beside the chat, as the page shows them and as storage holds them.
  const onThePage = `[...document.querySelectorAll(".claude-sticker")].map((p) => { const b = p.getBoundingClientRect(); return p.dataset.side + " " + (p.style.display === "none" ? "hidden" : [b.left, b.top, b.width, b.height].map(Math.round).join(",")) + " layer " + p.style.zIndex + " opacity " + p.style.opacity; })`;
  const inStorage = `chrome.storage.local.get(["placed", "stickers"]).then((kept) => "placed" in kept ? kept.placed.map((p) => p.side + " " + (p.id === "old" ? "old" : p.id === kept.stickers[kept.stickers.length - 1].id ? "dropped" : "?") + " " + [p.size, p.position, p.opacity, p.shift].join("/")).join(", ") || "(none)" : "(no list saved)")`;

  // ----- a Claude tab -----
  const claudeTab = await send("Target.createTarget", { url: "https://claude.ai/chat/demo" });
  const page = await attach(claudeTab.targetId);
  await sleep(2500);
  found.claudeTab = await run(page, `({ address: location.href, themed: document.documentElement.getAttribute("data-wallpaper"), sidebar: !!document.querySelector(".dframe-sidebar"), editor: !!document.getElementById("claude-themes-editor") })`);
  found.itsPictureIsStillShown = { onThePage: await run(page, onThePage), inStorage: await run(icon, inStorage) };

  found.iconClick = await clickIconOn("claude"); await sleep(2500);
  found.editorOverThePage = await run(page, `(() => { const f = document.getElementById("claude-themes-editor"); if (!f) return "no editor on the page"; const b = f.getBoundingClientRect(), s = getComputedStyle(f);
    return { covers: [b.left, b.top, b.width, b.height].join(","), window: innerWidth + "x" + innerHeight, onTop: s.zIndex, pageUnderneathUnmoved: document.querySelector(".dframe-sidebar").getBoundingClientRect().width + "/" + document.querySelector(".dframe-pane-primary").getBoundingClientRect().left }; })()`);

  const frameTarget = (await targets()).find((t) => t.url.startsWith(base + "editor.html?on=page"));
  found.editorPageLoaded = frameTarget ? "yes" : "no: the page's rules may have blocked it";
  if (frameTarget) {
    const editor = await attach(frameTarget.targetId);
    await sleep(600);
    const at = `(id) => { const e = document.getElementById(id); return e.hidden ? "hidden" : [e.style.left, e.style.top, e.style.width, e.style.height].map((v) => Math.round(parseFloat(v))).join(","); }`;
    // The grips over the pictures beside the chat, in the order they were made.
    const handles = `[...document.querySelectorAll(".grip")].map((e) => e.dataset.side + " " + (e.hidden ? "hidden" : [e.style.left, e.style.top, e.style.width, e.style.height].map((v) => Math.round(parseFloat(v))).join(",")) + (e.classList.contains("selected") ? " outlined" : ""))`;
    found.insideTheEditor = await run(editor, `(() => { const at = ${at}; return { mode: document.body.className, themeOn: document.getElementById("enabled").checked, sidebar: at("zone-sidebar"), main: at("zone-main"), left: at("zone-left"), right: at("zone-right"),
      seeThrough: getComputedStyle(document.body).backgroundColor, backgrounds: document.getElementById("presets").children.length, themes: document.getElementById("themes").children.length, foot: document.getElementById("about").textContent.replace(/\\s+/g, " ").trim().replace(/\\d+\\.\\d+\\.\\d+/, "<version>"), oldCopyNotice: !document.getElementById("stale").hidden }; })()`);

    // The picture an earlier version left has its grip, where the page says the picture is.
    found.insideTheEditor.handles = await run(editor, handles);

    found.openingTheEditorSavesNoList = await run(icon, inStorage);
    found.themeMidnight = await run(editor, `(async () => { document.querySelector('#themes .tile[data-theme="midnight"]').click(); await new Promise((r) => setTimeout(r, 500)); const kept = await chrome.storage.local.get(["preset", "textColor", "opacity"]); return kept.preset + " " + kept.textColor + " " + kept.opacity; })()`);
    found.pageShowsMidnight = await run(page, `(document.getElementById("claude-wallpaper").style.backgroundImage.includes("5, 7, 13") ? "midnight wash" : "another background") + ", text " + getComputedStyle(document.documentElement).getPropertyValue("--ct-text").trim()`);
    found.themeUndone = await run(editor, `(async () => { document.getElementById("undo").click(); await new Promise((r) => setTimeout(r, 500)); const kept = await chrome.storage.local.get({ preset: "dusk", textColor: null }); return kept.preset + " " + kept.textColor; })()`);
    // The ready-made theme took every side picture off and Undo put the old one back: the list is saved from now on.
    found.listIsSavedOnceItChanges = { inStorage: await run(icon, inStorage), onThePage: await run(page, onThePage) };
    found.chooseOcean = await run(editor, `(async () => { document.querySelector('.tile[data-id="ocean"]').click(); await new Promise((r) => setTimeout(r, 500)); return (await chrome.storage.local.get(["preset"])).preset; })()`);
    found.pageShowsOcean = await run(page, `document.getElementById("claude-wallpaper").style.backgroundImage.slice(0, 44)`);

    found.dropOnTheRight = await run(editor, `(async () => { const c = document.createElement("canvas"); c.width = 300; c.height = 240; const x = c.getContext("2d"); x.fillStyle = "#d97757"; x.beginPath(); x.arc(150, 120, 110, 0, 7); x.fill();
      const file = new File([await new Promise((ok) => c.toBlob(ok, "image/png"))], "drop.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(file);
      const zone = document.getElementById("zone-right"); for (const type of ["dragenter", "dragover", "drop"]) zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 1500)); return { kept: (await chrome.storage.local.get("stickers")).stickers.length, inStorage: await ${inStorage}, handles: ${handles}, said: document.getElementById("toast").textContent }; })()`);
    found.pageShowsThePicture = await run(page, onThePage);
    // A second one on the same side: clicking a saved side picture adds it in front, a little higher.
    found.addASecond = await run(editor, `(async () => { const tiles = document.querySelectorAll("#stickers .tile"); tiles[tiles.length - 1].click(); await new Promise((r) => setTimeout(r, 1200));
      return { inStorage: await ${inStorage}, handles: ${handles}, panel: document.getElementById("side-title").textContent }; })()`);
    found.pageShowsBoth = await run(page, onThePage);
    // Send it behind the first: the page changes the layers and leaves the two elements where they are.
    found.sendItBack = await run(editor, `(async () => { document.getElementById("layer-backward").click(); await new Promise((r) => setTimeout(r, 800));
      return { inStorage: await ${inStorage}, row: [...document.querySelectorAll("#side-placed .tile")].map((b) => b.getAttribute("aria-pressed") === "true" ? "chosen" : "other").join(", "), canStill: ["forward", "backward", "front", "back"].filter((how) => !document.getElementById("layer-" + how).disabled).join(",") }; })()`);
    found.pageShowsTheNewOrder = await run(page, onThePage);
    await picture(page, "real-page.png");

    // Move and resize a window with the mouse itself, as a person would.
    const boxOf = (what) => run(editor, `(() => { const b = document.querySelector(${JSON.stringify(what)}).getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; })()`);
    const round = (b) => [b.left, b.top, b.width, b.height].map(Math.round).join(",");
    const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 }, page);
    const dragWithMouse = async (from, across, down) => { const x = from.left + from.width / 2, y = from.top + from.height / 2; await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y); for (let step = 1; step <= 8; step++) { await mouse("mouseMoved", x + across * step / 8, y + down * step / 8); await sleep(20); } await mouse("mouseReleased", x + across, y + down); await sleep(250); };
    // Drag where the two pictures on the right overlap: the mouse picks up the one in front, and only that one moves.
    await dragWithMouse({ left: 1399, top: 599, width: 2, height: 2 }, -60, -100);
    found.draggingWhereTwoOverlap = { inStorage: await run(editor, inStorage), handles: await run(editor, handles), onThePage: await run(page, onThePage) };
    const first = round(await boxOf("#library"));
    await dragWithMouse(await boxOf("#library .titlebar b"), -220, -260);
    const moved = round(await boxOf("#library"));
    await dragWithMouse(await boxOf("#library .edge.se"), 140, 110);
    const resized = round(await boxOf("#library"));
    await dragWithMouse(await boxOf("#library .edge.w"), -90, 0);
    found.windowsWithARealMouse = { libraryFirst: first, afterDraggingTitleBar: moved, afterDraggingCorner: resized, afterDraggingLeftEdge: round(await boxOf("#library")), remembered: await run(editor, `chrome.storage.local.get("editorWindows").then((k) => JSON.stringify(k.editorWindows.library))`), pageUnderneathUnmoved: await run(page, `document.querySelector(".dframe-sidebar").getBoundingClientRect().width + "/" + document.querySelector(".dframe-pane-primary").getBoundingClientRect().left`) };
    await picture(page, "real-page-windows.png");

    // Claude's dark mode: the frame must stay see-through.
    await run(page, `document.documentElement.classList.add("dark"); document.documentElement.style.colorScheme = "dark"; document.documentElement.setAttribute("data-mode", "dark")`);
    await run(editor, `document.querySelector('.tile[data-id="none"]').click()`); await sleep(700);
    await picture(page, "real-page-dark.png");
    await run(page, `document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = ""`);

    // The theme's own buttons, in the editor as it really runs: framed inside the Claude page.
    found.themeButtons = await run(editor, `(async () => { const file = await themeFile(); document.getElementById("theme-save").click(); await new Promise((r) => setTimeout(r, 300)); const said = document.getElementById("toast").textContent; document.getElementById("theme-reset").click(); await new Promise((r) => setTimeout(r, 100)); const asked = !document.getElementById("ask").hidden; document.getElementById("ask-no").click(); return { fileHasSettings: Object.keys(file.settings).length > 30, saveSaid: said, resetAsksInsideTheEditor: asked }; })()`);
    await sleep(500);
    const savedTheme = resolve(downloads, "claude-theme.json");
    found.themeButtons.fileWritten = existsSync(savedTheme) ? "format " + JSON.parse(readFileSync(savedTheme, "utf8")).claudeThemes : "no file";
    found.done = await run(editor, `document.getElementById("done").click(), "clicked"`); await sleep(600);
    // Open it again: the windows are where they were left.
    await clickIconOn("claude"); await sleep(2000);
    const again = (await targets()).find((t) => t.url.startsWith(base + "editor.html?on=page"));
    if (again) { const second = await attach(again.targetId); await sleep(500); found.windowsRememberedNextTime = await run(second, `(() => { const b = document.getElementById("library").getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round).join(","); })()`); await run(second, `document.getElementById("done").click()`); await sleep(500); }
    found.afterDone = await run(page, `({ editor: !!document.getElementById("claude-themes-editor"), stillThemed: document.querySelectorAll('.claude-sticker[data-side="right"]').length })`);
  }

  // ----- pages that are not chats, and a chat that is no longer built as expected -----
  {
    const themed = () => run(page, `document.documentElement.getAttribute("data-wallpaper") || "off"`);
    await run(icon, `chrome.storage.local.set({ preset: "ocean" }).then(() => "set")`); await sleep(500);
    found.kindsOfPage = { aChat: await themed() };
    // Going to a list page the way claude.ai does: the address changes and the page is rebuilt, with no reload.
    await run(page, `(() => { window.kept = document.querySelector('[data-cds="ChatComposer"]'); window.keptIn = kept.parentNode; window.keptBefore = kept.nextSibling; kept.remove(); const list = document.createElement("div"); list.id = "list"; list.setAttribute("data-cds", "Page"); document.querySelector(".dframe-pane-primary").appendChild(list); history.pushState({}, "", "/cowork/projects"); return "gone"; })()`); await sleep(400);
    found.kindsOfPage.aListPage = await themed();
    // Back to a chat's address, with no message box on the page: fine while it could still be loading, then left alone.
    await run(page, `(() => { document.getElementById("list").remove(); history.pushState({}, "", "/chat/demo"); return "back"; })()`); await sleep(1500);
    found.kindsOfPage.aChatStillLoading = await themed();
    await sleep(6500);
    found.kindsOfPage.aChatThatNeverGotItsMessageBox = await themed();
    await run(page, `(() => { keptIn.insertBefore(kept, keptBefore); return "restored"; })()`); await sleep(500);
    found.kindsOfPage.aChatAgain = await themed();
  }

  // ----- the icon, from here and from elsewhere -----
  await clickIconOn("claude"); await sleep(1500);
  const openedAgain = await editorFrames();
  await clickIconOn("claude"); await sleep(800);
  found.iconOpensThenCloses = { afterFirstClick: openedAgain, afterSecondClick: await editorFrames() };

  found.iconClickElsewhere = await clickIconOn("another"); await sleep(1800);
  found.iconFromAnotherTab = { editorsOnTheClaudeTab: await editorFrames(), claudeTabInFront: await run(icon, `chrome.tabs.query({ active: true }).then((t) => t.map((x) => x.url).join(" "))`) };

  await send("Target.closeTarget", { targetId: claudeTab.targetId }); await sleep(800);
  await clickIconOn("another"); await sleep(3500);
  const fresh = (await targets()).filter((t) => t.type === "page" && t.url.startsWith("https://claude.ai/"));
  found.iconWithNoClaudeTab = { claudeTabsOpened: fresh.map((t) => t.url), editors: await editorFrames() };

  found.problems = events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params.entry.level === "error"))
    .map((e) => (e.params.exceptionDetails?.exception?.description || e.params.entry?.text || "").slice(0, 200)).slice(0, 8);
  console.log(JSON.stringify(found, null, 1));
} finally {
  chrome.kill("SIGKILL"); server.close(); await sleep(400); rmSync(profile, { recursive: true, force: true });
}
