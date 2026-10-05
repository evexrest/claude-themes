// Open a page in a throwaway headless Chrome and take several screenshots in real time.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
const [url, profile, count = "5", gap = "170"] = process.argv.slice(2);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--allow-file-access-from-files", "--remote-debugging-port=9377", `--user-data-dir=${profile}`, "--window-size=260,320", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch("http://127.0.0.1:9377/json")).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (waiting.has(d.id)) { waiting.get(d.id)(d.result); waiting.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { waiting.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Page.enable"); await send("Page.navigate", { url }); await sleep(1500);
  const hashes = [];
  for (let i = 0; i < Number(count); i++) { const shot = await send("Page.captureScreenshot", { format: "png" }); const buf = Buffer.from(shot.data, "base64"); hashes.push(createHash("md5").update(buf).digest("hex").slice(0, 8)); if (i < 2) writeFileSync(`live${i}.png`, buf); await sleep(Number(gap)); }
  console.log("screenshots:", hashes.join(" "), "| different pictures:", new Set(hashes).size);
  ws.close();
} finally { chrome.kill("SIGKILL"); await sleep(300); rmSync(profile, { recursive: true, force: true }); }
