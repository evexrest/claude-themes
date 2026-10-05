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
import { writeFileSync, readFileSync, rmSync, mkdirSync } from "node:fs";
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
  // Click the toolbar icon while a given tab is the one in front.
  const clickIconOn = (which) => run(icon, `(async () => { const tabs = await chrome.tabs.query({}); const claudeTab = (t) => (t.url || t.pendingUrl || "").startsWith("https://claude.ai/"); const tab = tabs.find((t) => ${JSON.stringify(which)} === "claude" ? claudeTab(t) : !claudeTab(t)); if (!tab) return "no such tab"; await chrome.tabs.update(tab.id, { active: true }); chrome.action.onClicked.dispatch(tab); return "clicked"; })()`);
  const editorFrames = async () => (await targets()).filter((t) => t.url.startsWith(base + "editor.html?on=page")).length;

  // ----- a Claude tab -----
  const claudeTab = await send("Target.createTarget", { url: "https://claude.ai/chat/demo" });
  const page = await attach(claudeTab.targetId);
  await sleep(2500);
  found.claudeTab = await run(page, `({ address: location.href, themed: document.documentElement.getAttribute("data-wallpaper"), sidebar: !!document.querySelector(".dframe-sidebar"), editor: !!document.getElementById("claude-themes-editor") })`);

  found.iconClick = await clickIconOn("claude"); await sleep(2500);
  found.editorOverThePage = await run(page, `(() => { const f = document.getElementById("claude-themes-editor"); if (!f) return "no editor on the page"; const b = f.getBoundingClientRect(), s = getComputedStyle(f);
    return { covers: [b.left, b.top, b.width, b.height].join(","), window: innerWidth + "x" + innerHeight, onTop: s.zIndex, pageUnderneathUnmoved: document.querySelector(".dframe-sidebar").getBoundingClientRect().width + "/" + document.querySelector(".dframe-pane-primary").getBoundingClientRect().left }; })()`);

  const frameTarget = (await targets()).find((t) => t.url.startsWith(base + "editor.html?on=page"));
  found.editorPageLoaded = frameTarget ? "yes" : "no: the page's rules may have blocked it";
  if (frameTarget) {
    const editor = await attach(frameTarget.targetId);
    await sleep(600);
    const at = `(id) => { const e = document.getElementById(id); return e.hidden ? "hidden" : [e.style.left, e.style.top, e.style.width, e.style.height].map((v) => Math.round(parseFloat(v))).join(","); }`;
    found.insideTheEditor = await run(editor, `(() => { const at = ${at}; return { mode: document.body.className, themeOn: document.getElementById("enabled").checked, sidebar: at("zone-sidebar"), main: at("zone-main"), left: at("zone-left"), right: at("zone-right"),
      seeThrough: getComputedStyle(document.body).backgroundColor, backgrounds: document.getElementById("presets").children.length, oldCopyNotice: !document.getElementById("stale").hidden }; })()`);

    found.chooseOcean = await run(editor, `(async () => { document.querySelector('.tile[data-id="ocean"]').click(); await new Promise((r) => setTimeout(r, 500)); return (await chrome.storage.local.get(["preset"])).preset; })()`);
    found.pageShowsOcean = await run(page, `document.getElementById("claude-wallpaper").style.backgroundImage.slice(0, 44)`);

    found.dropOnTheRight = await run(editor, `(async () => { const c = document.createElement("canvas"); c.width = 300; c.height = 240; const x = c.getContext("2d"); x.fillStyle = "#d97757"; x.beginPath(); x.arc(150, 120, 110, 0, 7); x.fill();
      const file = new File([await new Promise((ok) => c.toBlob(ok, "image/png"))], "drop.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(file);
      const zone = document.getElementById("zone-right"); for (const type of ["dragenter", "dragover", "drop"]) zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 1500)); const saved = await chrome.storage.local.get(["stickers", "stickerRight"]); const at = ${at};
      return { kept: saved.stickers.length, onTheRight: saved.stickerRight === saved.stickers[0].id, handleAt: at("grip-right"), said: document.getElementById("toast").textContent }; })()`);
    found.pageShowsThePicture = await run(page, `(() => { const p = document.querySelector('.claude-sticker[data-side="right"]'); if (!p) return "no picture on the page"; const b = p.getBoundingClientRect(); return { shown: p.style.display, at: [b.left, b.top, b.width, b.height].map(Math.round).join(",") }; })()`);
    await picture(page, "real-page.png");

    // Claude's dark mode: the frame must stay see-through.
    await run(page, `document.documentElement.classList.add("dark"); document.documentElement.style.colorScheme = "dark"; document.documentElement.setAttribute("data-mode", "dark")`);
    await run(editor, `document.querySelector('.tile[data-id="none"]').click()`); await sleep(700);
    await picture(page, "real-page-dark.png");
    await run(page, `document.documentElement.classList.remove("dark"); document.documentElement.style.colorScheme = ""`);

    found.done = await run(editor, `document.getElementById("done").click(), "clicked"`); await sleep(600);
    found.afterDone = await run(page, `({ editor: !!document.getElementById("claude-themes-editor"), stillThemed: !!document.querySelector('.claude-sticker[data-side="right"]') })`);
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
