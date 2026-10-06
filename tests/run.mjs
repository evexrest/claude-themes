// Runs every browser test and says PASS or FAIL.
//
//   node tests/run.mjs            run everything and compare with tests/expected/
//   node tests/run.mjs logic      run only the suites named
//   node tests/run.mjs --update   run everything and save what it gives as the new expected results
//
// Each suite prints a set of named results (see README.md). `tests/expected/` holds
// what each gave when it was last looked over by a person and found right. A run
// passes when every result is the same as that. So a FAIL means "this changed", and
// the lines under it show what was expected and what came out: either the change
// broke something, or it was meant, and then `--update` records the new results.
//
// The expected results were made on a Mac with Chrome 154 and a 1512-wide test
// window. Sizes that depend on fonts can differ on another computer.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const expectedIn = join(here, "expected");

const suites = [
    { name: "logic", what: "the page script and stylesheet", run: ["zsh", [join(here, "dump.sh"), "logic", "16000"]] },
    { name: "editor-logic", what: "the editor in a tab", run: ["zsh", [join(here, "dump.sh"), "editor-logic", "26000"]] },
    { name: "editor-page-logic", what: "the editor over the page", run: ["zsh", [join(here, "dump.sh"), "editor-page-logic", "14000", "on=page"]] },
    { name: "options-logic", what: "the upload page", run: ["zsh", [join(here, "dump.sh"), "options-logic"]] },
    { name: "real", what: "the folder loaded as a real extension", run: ["node", [join(here, "real.mjs")]] }
];

// A saved picture's id is made from the time it was saved, so it is different on
// every run. Any such id is replaced with the word "<id>" before comparing.
function steady(value) {
    if (typeof value === "string") {
        return value.replace(/\b[k-o][a-z0-9]{7,9}\b/g, (word) => /\d/.test(word) ? "<id>" : word);
    }
    if (Array.isArray(value)) {
        return value.map(steady);
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, steady(inner)]));
    }
    return value;
}

// Every place where two results differ, as "path: expected -> got" lines.
function differences(expected, got, path = "") {
    if (JSON.stringify(expected) === JSON.stringify(got)) {
        return [];
    }
    const both = (thing) => thing && typeof thing === "object" && !Array.isArray(thing);
    if (both(expected) && both(got)) {
        const keys = [...new Set([...Object.keys(expected), ...Object.keys(got)])];
        return keys.flatMap((key) => differences(expected[key], got[key], path ? path + "." + key : key));
    }
    const show = (thing) => thing === undefined ? "(nothing)" : JSON.stringify(thing);
    return [`${path}: expected ${show(expected)}, got ${show(got)}`];
}

function results(suite) {
    const [command, parts] = suite.run;
    const printed = execFileSync(command, parts, { cwd: dirname(here), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const start = printed.indexOf("{");
    const end = printed.lastIndexOf("}");
    if (start < 0 || end < 0) {
        throw new Error("it printed no results: " + printed.trim().slice(0, 300));
    }
    return steady(JSON.parse(printed.slice(start, end + 1)));
}

const asked = process.argv.slice(2);
const update = asked.includes("--update");
const names = asked.filter((word) => !word.startsWith("--"));
const chosen = names.length > 0 ? suites.filter((suite) => names.includes(suite.name)) : suites;
if (chosen.length === 0) {
    console.error("No such suite. There are: " + suites.map((suite) => suite.name).join(", "));
    process.exit(2);
}

// The editor and upload test pages are put together from the real pages first.
execFileSync("python3", [join(here, "build.py")], { cwd: dirname(here), stdio: "ignore" });
mkdirSync(expectedIn, { recursive: true });

let failed = 0;
for (const suite of chosen) {
    const file = join(expectedIn, suite.name + ".json");
    let got;
    try {
        got = results(suite);
    } catch (error) {
        failed++;
        console.log(`FAIL  ${suite.name} (${suite.what}): ${error.message.split("\n")[0]}`);
        continue;
    }

    // A suite that caught an error of its own has failed, whatever else it gave.
    const errors = Array.isArray(got.errors) ? got.errors : [];
    const count = Object.keys(got).length;

    if (update) {
        writeFileSync(file, JSON.stringify(got, null, 1) + "\n");
        console.log(`SAVED ${suite.name}: ${count} results`);
        continue;
    }
    if (!existsSync(file)) {
        failed++;
        console.log(`FAIL  ${suite.name}: no expected results yet. Run with --update once they have been looked over.`);
        continue;
    }

    const lines = differences(JSON.parse(readFileSync(file, "utf8")), got);
    if (lines.length === 0 && errors.length === 0) {
        console.log(`PASS  ${suite.name} (${suite.what}): ${count} results`);
    } else {
        failed++;
        console.log(`FAIL  ${suite.name} (${suite.what}): ${lines.length} of its results changed`);
        for (const line of [...errors.map((error) => "error on the page: " + error), ...lines].slice(0, 40)) {
            console.log("      " + line);
        }
    }
}

if (!update) {
    console.log(failed === 0 ? "\nAll passed." : `\n${failed} of ${chosen.length} failed.`);
}
process.exit(failed === 0 ? 0 : 1);
