// Load the extension itself, as Chrome will, into a throwaway headless Chrome and
// open its editor. This is the only check that uses Chrome's real extension system
// (the manifest, the toolbar-icon script, real storage) and not the stand-in.
// usage: node tests/real.mjs [profile-folder]
// Prints what it found as JSON and saves a picture of the editor as tests/real.png.
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const tests = dirname(fileURLToPath(import.meta.url));
const project = resolve(tests, "..");
const profile = process.argv[2] || resolve(tests, ".profile-real-" + process.pid);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome is driven through a pipe, which is what lets a folder be loaded as an extension.
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-pipe", "--enable-unsafe-extension-debugging",
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
const attach = async (targetId) => (await send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
const run = async (session, expression) => {
  const out = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, session);
  return out.error || (out.exceptionDetails ? "threw: " + (out.exceptionDetails.exception?.description || out.exceptionDetails.text) : out.result.value);
};

const found = {};
try {
  await sleep(1500);
  const loaded = await send("Extensions.loadUnpacked", { path: project });
  found.loaded = loaded.error || "yes";
  const base = `chrome-extension://${loaded.id}/`;
  await sleep(1500);

  // The toolbar-icon script.
  let targets = (await send("Target.getTargets")).targetInfos;
  const worker = targets.find((t) => t.type === "service_worker" && t.url.startsWith(base));
  found.iconScript = worker ? worker.url.slice(base.length) : "not running";

  // The editor.
  const page = await send("Target.createTarget", { url: base + "editor.html?w=1512&h=860" });
  const editor = await attach(page.targetId);
  await send("Runtime.enable", {}, editor); await send("Log.enable", {}, editor);
  await sleep(2500);
  found.editor = await run(editor, `(() => { const p = document.getElementById("preview").contentDocument; const side = p.querySelector(".dframe-sidebar").getBoundingClientRect(); return {
    title: document.title, themeOn: document.getElementById("enabled").checked, showing: document.getElementById("main-now").textContent,
    oldCopyNotice: !document.getElementById("stale").hidden, version: chrome.runtime.getManifest().version,
    screen: document.getElementById("screen").style.width + " x " + document.getElementById("screen").style.height,
    previewBackgroundOn: p.documentElement.getAttribute("data-wallpaper"), previewSidebarWidth: side.width,
    partsFound: document.querySelectorAll(".zone").length, backgrounds: document.getElementById("presets").children.length }; })()`);

  // Change a setting the way a click does, and see that real storage and the preview follow.
  found.afterChoosingOcean = await run(editor, `(async () => { document.querySelector('.tile[data-id="ocean"]').click(); await new Promise((r) => setTimeout(r, 400));
    const saved = await chrome.storage.local.get(["preset"]); const wall = document.getElementById("preview").contentDocument.getElementById("claude-wallpaper");
    return { saved: saved.preset, previewShows: wall.style.backgroundImage.slice(0, 40), undoReady: !document.getElementById("undo").disabled }; })()`);

  // Drop a picture on the right-hand side of the screen.
  found.afterDroppingAPicture = await run(editor, `(async () => { const c = document.createElement("canvas"); c.width = 300; c.height = 200; c.getContext("2d").fillRect(0, 0, 300, 200);
    const file = new File([await new Promise((ok) => c.toBlob(ok, "image/png"))], "drop.png", { type: "image/png" }); const dt = new DataTransfer(); dt.items.add(file);
    const zone = document.getElementById("zone-right"); for (const type of ["dragenter", "dragover", "drop"]) zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    await new Promise((r) => setTimeout(r, 1200)); const saved = await chrome.storage.local.get(["stickers", "stickerRight"]);
    const shown = document.getElementById("preview").contentDocument.querySelector('.claude-sticker[data-side="right"]');
    return { kept: saved.stickers.length, onTheRight: saved.stickerRight === saved.stickers[0].id, inPreview: !!shown && shown.style.display, gripShown: !document.getElementById("grip-right").hidden, said: document.getElementById("toast").textContent }; })()`);

  const shot = await send("Page.captureScreenshot", { format: "png" }, editor);
  if (shot.data) writeFileSync(resolve(tests, "real.png"), Buffer.from(shot.data, "base64"));

  // The toolbar icon, with the editor open and then with it closed.
  if (worker) {
    const icon = await attach(worker.targetId);
    const count = async () => (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.url.startsWith(base + "editor.html")).length;
    found.editorAnswersTheIcon = await run(icon, `chrome.runtime.sendMessage({ type: "show-editor" }).catch((e) => "no answer: " + e.message)`);
    const click = `(async () => { const tab = { id: 0 }; if (chrome.action.onClicked.dispatch) { chrome.action.onClicked.dispatch(tab); return "clicked"; } return "cannot click from here"; })()`;
    found.iconClickWithEditorOpen = { click: await run(icon, click), editorsOpen: (await sleep(800), await count()) };
    await send("Target.closeTarget", { targetId: page.targetId }); await sleep(600);
    found.iconClickWithEditorClosed = { click: await run(icon, click), editorsOpen: (await sleep(1200), await count()) };
  }

  found.problems = events.filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params.entry.level === "error"))
    .map((e) => e.params.exceptionDetails?.exception?.description || e.params.entry?.text).slice(0, 8);
  console.log(JSON.stringify(found, null, 1));
} finally {
  chrome.kill("SIGKILL"); await sleep(400); rmSync(profile, { recursive: true, force: true });
}
