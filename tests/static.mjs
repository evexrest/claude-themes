// Checks that need no browser, so they can run anywhere, on every push:
//
//   node tests/static.mjs
//
// - every script is valid JavaScript
// - the manifest is valid, and every file it names is there
// - the two version numbers agree (see settings.js)
// - every page loads only files that are in the folder
// - nothing in the extension talks to the internet, which is what PRIVACY.md promises

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

const folder = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(folder, name), "utf8");
const shipped = readdirSync(folder).filter((name) => /\.(js|html|css|json)$/.test(name));
const problems = [];
const check = (fine, problem) => {
    if (!fine) {
        problems.push(problem);
    }
};

// Scripts.
for (const name of shipped.filter((file) => file.endsWith(".js"))) {
    try {
        execFileSync("node", ["--check", join(folder, name)], { stdio: "pipe" });
    } catch (error) {
        problems.push(`${name} is not valid JavaScript: ${String(error.stderr).split("\n").slice(0, 3).join(" ")}`);
    }
}

// The test pages' own scripts. One that does not parse runs nothing at all, and the
// browser tests then only say that a page printed no results.
const testsIn = join(folder, "tests");
const testPages = [...readdirSync(join(testsIn, "fragments")).map((name) => join("fragments", name)), "logic.html"].filter((name) => name.endsWith(".html"));
for (const name of testPages) {
    for (const [, code] of readFileSync(join(testsIn, name), "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)) {
        try {
            new Script(code);
        } catch (error) {
            problems.push(`tests/${name} has a script that is not valid JavaScript: ${error.message}`);
        }
    }
}

// The manifest, and the files it names.
let manifest = {};
try {
    manifest = JSON.parse(read("manifest.json"));
} catch (error) {
    problems.push("manifest.json is not valid JSON: " + error.message);
}
check(manifest.manifest_version === 3, "manifest.json: manifest_version should be 3");
check(/^\d+\.\d+\.\d+$/.test(manifest.version || ""), "manifest.json: the version should be three numbers, like 1.2.3");
check((manifest.description || "").length <= 132, "manifest.json: the description is over the Chrome Web Store's 132 characters");

const named = [
    ...Object.values(manifest.icons || {}),
    ...Object.values((manifest.action || {}).default_icon || {}),
    ...(manifest.content_scripts || []).flatMap((entry) => [...(entry.js || []), ...(entry.css || [])]),
    ...(manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || []),
    (manifest.background || {}).service_worker,
    manifest.options_page
].filter(Boolean);
for (const name of named) {
    check(existsSync(join(folder, name)), `manifest.json names ${name}, which is not in the folder`);
}
for (const size of ["16", "32", "48", "128"]) {
    check((manifest.icons || {})[size], `manifest.json has no ${size}px icon`);
}

// The two version numbers.
const files = /const filesVersion = "([^"]+)"/.exec(read("settings.js"));
check(files && files[1] === manifest.version,
    `settings.js says version ${files ? files[1] : "(none)"} and manifest.json says ${manifest.version}; they must be the same`);

// Pages load only what is in the folder.
for (const name of shipped.filter((file) => file.endsWith(".html"))) {
    for (const [, loaded] of read(name).matchAll(/<(?:script|link|img|iframe)[^>]*?\s(?:src|href|data-src)="([^"]+)"/g)) {
        if (/^(https?:)?\/\//.test(loaded)) {
            problems.push(`${name} loads ${loaded} from the internet`);
        } else if (!loaded.startsWith("#") && !loaded.startsWith("data:")) {
            check(existsSync(join(folder, loaded.split(/[?#]/)[0])), `${name} loads ${loaded}, which is not in the folder`);
        }
    }
}

// Nothing talks to the internet. The only addresses allowed are claude.ai (the page
// the extension runs on, and tabs it opens), the name of the SVG format, and
// chrome://extensions in a message to the user.
// The project's own GitHub pages are allowed as links a person clicks (report a
// problem, the privacy statement): they open in a tab, and the extension itself
// asks them for nothing.
const allowed = [/^https:\/\/claude\.ai\//, /^http:\/\/www\.w3\.org\/2000\/svg$/, /^https:\/\/github\.com\/evexrest\/claude-themes\//];
for (const name of shipped.filter((file) => file.endsWith(".js"))) {
    check(!/github\.com/.test(read(name)), `${name} mentions GitHub: links belong in the pages, where a person clicks them`);
}
for (const name of shipped.filter((file) => /\.(js|html|css)$/.test(file))) {
    const text = read(name);
    for (const [address] of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
        check(allowed.some((pattern) => pattern.test(address)), `${name} mentions ${address}`);
    }
    check(!/\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b|\bEventSource\b/.test(text), `${name} uses a way of talking to the internet`);
    // fetch() is used only to turn a picture already held in the page into a file.
    for (const [call] of text.matchAll(/\bfetch\(([^)]*)\)/g)) {
        check(!/https?:/.test(call), `${name} fetches from the internet: ${call}`);
    }
}
check((manifest.host_permissions || []).every((host) => host === "https://claude.ai/*"),
    "manifest.json asks for a site other than claude.ai");

if (problems.length === 0) {
    console.log(`PASS  static checks: ${shipped.length} files, version ${manifest.version}`);
} else {
    console.log(`FAIL  static checks: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const problem of problems) {
        console.log("      " + problem);
    }
}
process.exit(problems.length === 0 ? 0 : 1);
