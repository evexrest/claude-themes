// The editor. It runs in two places. Laid over the real claude.ai page
// (editor.html?on=page, in a frame that content.js adds), the page itself is what
// gets clicked and dropped on. In a tab of its own, a stand-in for claude.ai
// (preview.html) takes the page's place. Either way, three small windows float
// over it: a bar, the library of pictures, and the settings of the part that is
// selected. They can be moved, resized, folded away and closed like any window.
// Every change to the theme is saved straight away, and the page picks it up from
// storage. `defaults`, `presets`,
// `frames`, `frameValues`, `fonts`, `imageKey`, `stickerKey`, `newId`,
// `readSettings`, `mostPlaced`, `placedLimits`, `placedWith` and `filesVersion`
// come from settings.js.

const preview = document.getElementById("preview");
const screenBox = document.getElementById("screen");
const stage = document.getElementById("stage");
const toast = document.getElementById("toast");

// A few text colours that are easy to read on most backgrounds, and a few for the
// words Claude marks out.
const textSwatches = ["#ffffff", "#f5f0e6", "#cfcfcf", "#ffe9a8", "#0b0b0b", "#2b2b2b", "#10254a", "#3d1010"];
const codeSwatches = ["#ffffff", "#ffb3b3", "#ffd479", "#a8e6a1", "#8fd3ff", "#d9b8ff", "#0b0b0b", "#0d4a8f"];

const maxSavedWidth = 2560;
const maxMovingBytes = 25 * 1024 * 1024;
const maxStickerBytes = 12 * 1024 * 1024;

// The parts of the screen that can be selected, and the two of them that are the
// empty space beside the chat.
const parts = ["main", "sidebar", "left", "right"];
const sides = ["left", "right"];

// The preview is drawn at the size of a real browser window, then shrunk to fit.
// The address can ask for another size: editor.html?w=1512&h=860.
const asked = new URLSearchParams(location.search);
// Whether this editor lies over the real page.
const onPage = asked.get("on") === "page";
const screenWidth = Number(asked.get("w")) || Math.min(2200, Math.max(1200, screen.availWidth));
const screenHeight = Number(asked.get("h")) || Math.min(1400, Math.max(700, screen.availHeight - 90));

let state = { ...defaults };
let part = "main";
// The side a side picture goes to when neither side is selected.
let lastSide = "right";
// The key of the picture that was last chosen on each side. See chosenOn.
const chosen = { left: null, right: null };
let scale = 1;
// Over the real page: where its parts are, as content.js last measured them.
let pageBoxes = null;
// What is being dragged: { kind, id } for a picture from the library, or
// { kind: "files" } for files from the computer.
let dragged = null;

// Each control adds a function here that shows the current settings in it.
const updaters = [];

// Changes that can be undone, and undone changes that can be redone. Each step
// holds the settings as they were `before` and `after`.
const steps = [];
const undoneSteps = [];
let lastKeys = "";
let lastTime = 0;

function byId(id) {
    return document.getElementById(id);
}

function press(button, on) {
    button.setAttribute("aria-pressed", on);
}

function clamp(number, least, most) {
    return Math.min(most, Math.max(least, number));
}

// Show a short message under the screen for a few seconds.
let toastTimer = null;
function say(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, 6000);
}

// Save a change. `how` says what Undo should make of it: "step" is one step,
// "flow" is one of many small changes from a slider or a drag, which together
// make one step, and "none" is left out. `what` says what a flow is changing,
// where the names of the settings do not: the pictures beside the chat are all
// kept in one setting.
function save(change, how = "step", what = "") {
    if (how !== "none") {
        remember(change, how === "flow", what);
    }
    Object.assign(state, change);
    // Chrome can refuse to store a change (a full disk, a profile it cannot write to).
    // The page only ever shows what is stored, so the editor reads that back. Earlier
    // steps may have been refused too, so Undo starts again from here.
    chrome.storage.local.set(change).catch(async (error) => {
        const kept = await readSettings();
        for (const key of Object.keys(change)) {
            state[key] = kept[key];
        }
        forgetHistory();
        sync();
        say("Chrome could not save that change, so it was put back. " + error.message);
    });
    sync();
}

function remember(change, flowing, what) {
    const keys = Object.keys(change).sort().join(" ") + " " + what;
    const now = Date.now();
    const last = steps[steps.length - 1];

    if (flowing && last && keys === lastKeys && now - lastTime < 1000) {
        Object.assign(last.after, change);
    } else {
        const before = {};
        for (const key of Object.keys(change)) {
            before[key] = state[key];
        }
        steps.push({ before: before, after: { ...change } });
        if (steps.length > 200) {
            steps.shift();
        }
    }
    lastKeys = flowing ? keys : "";
    lastTime = now;
    undoneSteps.length = 0;
}

function undo() {
    const step = steps.pop();
    if (step) {
        undoneSteps.push(step);
        lastKeys = "";
        save(step.before, "none");
    }
}

function redo() {
    const step = undoneSteps.pop();
    if (step) {
        steps.push(step);
        lastKeys = "";
        save(step.after, "none");
    }
}

// Removing a picture cannot be undone, and earlier steps may point at it.
function forgetHistory() {
    steps.length = 0;
    undoneSteps.length = 0;
    lastKeys = "";
}

// Select a part of the screen.
function choose(name) {
    part = name;
    if (sides.includes(name)) {
        lastSide = name;
    }
    sync();
    layout();
}

// The pictures on one side of the chat, from the back to the front.
function placedOn(side) {
    return state.placed.filter((item) => item.side === side);
}

// The picture that is chosen on one side: the one its sliders, its layer buttons
// and the Delete key work on. It is the one last picked there, or the one in front
// when that one has gone or none has been picked. Null when the side has no picture.
function chosenOn(side) {
    const here = placedOn(side);
    return here.find((item) => item.key === chosen[side]) || here[here.length - 1] || null;
}

// Change one of the pictures beside the chat. They are saved together, as one
// list, so Undo is told which picture, and which of its values, a slider or a
// drag is changing.
function changePlaced(key, change, how = "step") {
    const list = state.placed.map((item) => item.key === key ? { ...item, ...change } : item);
    save({ placed: list }, how, key + " " + Object.keys(change).join(" "));
}

// Take one picture off the page. It stays in the library.
function removePlaced(key) {
    save({ placed: state.placed.filter((item) => item.key !== key) });
}

// Where each layer button takes a picture beside the chat: its new place in the
// list, counted from the back, or -1 for nowhere. `from` is where it is now, and
// `mine` is true of a picture on its own side. The first two take it past the next
// picture on its side, so that the side's row of pictures always shows the change.
// The other two take it in front of, or behind, every picture on either side: a
// picture can be dragged anywhere in the chat window, over one from the other side.
const layerMoves = {
    forward: (list, from, mine) => list.findIndex((item, index) => index > from && mine(item)),
    backward: (list, from, mine) => list.findLastIndex((item, index) => index < from && mine(item)),
    front: (list) => list.length - 1,
    back: () => 0
};

// The list with one picture moved to another layer, or null when that would change
// nothing. `how` is one of the names above.
function relayered(list, key, how) {
    const from = list.findIndex((item) => item.key === key);
    const to = layerMoves[how](list, from, (item) => item.side === list[from].side);
    if (to < 0 || to === from) {
        return null;
    }
    const moved = list.filter((item) => item.key !== key);
    moved.splice(to, 0, list[from]);
    return moved;
}

// What to say when there is no room beside the chat for another picture.
const noRoom = `There are already ${mostPlaced} pictures beside the chat, which is the most there can be. Take one off to add another.`;

// Put a saved side picture beside the chat, on one side and in front of the
// others, and choose it. Returns false when there is no room for another.
function placePicture(id, side) {
    const list = placedWith(state.placed, id, side);
    if (!list) {
        say(noRoom);
        return false;
    }
    chosen[side] = list[list.length - 1].key;
    save({ placed: list, enabled: true });
    choose(side);
    return true;
}

// ---------- The controls on the right ----------

// Tie a slider to a setting. `shown` turns the slider's number into the text
// beside it, `stored` turns it into the value that is saved, and `slid` turns a
// saved value back into the slider's number.
function slider(id, key, shown, stored, slid) {
    const input = byId(id);
    const label = byId(id + "-value");

    input.addEventListener("input", () => {
        save({ [key]: stored(Number(input.value)) }, "flow");
    });
    updaters.push(() => {
        input.value = slid(state[key]);
        label.textContent = shown(Number(input.value));
    });
}

// The main picture's Zoom slider. Until it has been moved the layout is automatic,
// worked out from the picture's shape: a landscape picture is stretched to its
// space and any other fills the page.
function mainZoom() {
    const input = byId("zoom");

    input.addEventListener("input", () => {
        save({ imageZoom: zoomStored(Number(input.value)) }, "flow");
    });
    byId("zoom-auto").addEventListener("click", () => {
        save({ imageZoom: null });
    });
    updaters.push(() => {
        const automatic = state.imageZoom === null;
        const shape = shapes.get(state.imageId);
        const stretched = automatic && shape && stretches(shape.width, shape.height);
        // A stretched picture is all in view, so the slider sits at the whole-picture end.
        input.value = automatic ? (stretched ? 0 : 100) : hundredths(state.imageZoom);
        byId("zoom-value").textContent = automatic
            ? (stretched ? "Stretched to fit" : "Fills") + ", automatic"
            : zoomed(Number(input.value));
        byId("zoom-auto").hidden = automatic;
        showStage((measure() || {}).sidebar);
        if (automatic && !shape) {
            readShape(state.imageId);
        }
    });
}

// The shape of each saved image, read from its small copy, which has the same
// proportions. The automatic zoom depends on it.
const shapes = new Map();
function readShape(id) {
    const image = state.images.find((item) => item.id === id);
    if (!image || !image.thumb || shapes.has(id)) {
        return;
    }
    shapes.set(id, null);
    const small = new Image();
    small.addEventListener("load", () => {
        shapes.set(id, { width: small.naturalWidth, height: small.naturalHeight });
        sync();
    });
    small.src = image.thumb;
}

// The same for one of the numbers of a picture beside the chat (`what` is "size",
// "position" or "opacity"): the slider shows and changes it for the picture that is
// chosen on the selected side, between the least and the most it may be.
function sideSlider(id, what, shown, stored, slid) {
    const input = byId(id);
    const label = byId(id + "-value");
    [input.min, input.max] = placedLimits[what].map(slid);

    input.addEventListener("input", () => {
        const item = chosenOn(part);
        if (item) {
            changePlaced(item.key, { [what]: stored(Number(input.value)) }, "flow");
        }
    });
    updaters.push(() => {
        const item = chosenOn(part);
        if (item) {
            input.value = slid(item[what]);
            label.textContent = shown(Number(input.value));
        }
    });
}

const percent = (number) => number + "%";
const pixels = (number) => number + "px";
const fraction = (number) => number / 100;
const hundredths = (number) => Math.round(number * 100);
const same = (number) => number;
const place = (number) => number < 20 ? "Top" : number > 80 ? "Bottom" : "Middle";
// A zoom slider runs from 0 (the whole picture) through 100 (the picture fills its
// part of the screen) to 400. Near 100 it settles on 100, which is hard to hit.
const zoomed = (number) => number === 0 ? "Whole picture" : number === 100 ? "Fills" : number + "%";
const zoomStored = (number) => Math.abs(number - 100) <= 4 ? 1 : number / 100;

// A row of colour buttons and its colour picker, for one colour setting. A null
// colour means Claude's own.
function colours(rowId, pickerId, key, list, fallback) {
    const row = byId(rowId);
    const picker = byId(pickerId);
    const all = [null, ...list];

    const buttons = all.map((colour) => {
        const button = document.createElement("button");
        button.className = "swatch";
        if (colour) {
            button.style.backgroundColor = colour;
            button.title = colour;
        } else {
            button.textContent = "Auto";
            button.title = "Claude's own colour";
        }
        button.addEventListener("click", () => {
            save({ [key]: colour });
        });
        row.appendChild(button);
        return button;
    });

    picker.addEventListener("input", () => {
        save({ [key]: picker.value }, "flow");
    });
    updaters.push(() => {
        buttons.forEach((button, index) => press(button, state[key] === all[index]));
        picker.value = state[key] || fallback;
    });
}

// A font list and the box for typing another font's name, for one font setting.
function fontChoice(listId, boxId, fontKey, nameKey) {
    const list = byId(listId);
    const box = byId(boxId);

    for (const item of fonts) {
        list.add(new Option(item.name, item.id));
    }
    list.addEventListener("change", () => {
        save({ [fontKey]: list.value });
    });
    box.addEventListener("input", () => {
        save({ [nameKey]: box.value }, "flow");
    });
    updaters.push(() => {
        list.value = state[fontKey];
        box.hidden = state[fontKey] !== "custom";
        // Left alone while it is being typed in.
        if (document.activeElement !== box) {
            box.value = state[nameKey];
        }
    });
}

// A group of buttons of which one is selected, for a setting with a few named values.
function oneOf(key, ids) {
    for (const value of Object.keys(ids)) {
        byId(ids[value]).addEventListener("click", () => {
            save({ [key]: value });
        });
    }
    updaters.push(() => {
        for (const value of Object.keys(ids)) {
            press(byId(ids[value]), state[key] === value);
        }
    });
}

// One small button showing a frame. `key` is the setting it changes, for example
// "frameSidebar".
function frameChoice(row, key, id, name) {
    const button = document.createElement("button");
    button.className = "frame-choice";
    button.title = name;
    button.setAttribute("aria-label", name);
    button.dataset.key = key;
    button.dataset.frame = id;

    const values = frameValues(id, 16, state.frameImage, state.frameSlice);
    if (values) {
        const sample = document.createElement("div");
        sample.className = "sample";
        for (const value of Object.keys(values)) {
            sample.style.setProperty("--sample-" + value, values[value]);
        }
        // Samples are small, so every frame is drawn at the same thin width.
        sample.style.setProperty("--sample-width", id === "fineliner" ? "2px" : "9px");
        button.appendChild(sample);
    } else {
        button.textContent = "Off";
    }

    button.addEventListener("click", () => {
        save({ [key]: id });
    });
    row.appendChild(button);
}

// The rows of frames. Drawn again when the uploaded frame changes.
function showFrames() {
    const rows = { "frames-main": "frameMain", "frames-all": "frameAll", "frames-sidebar": "frameSidebar" };

    for (const rowId of Object.keys(rows)) {
        const row = byId(rowId);
        row.replaceChildren();
        frameChoice(row, rows[rowId], "none", "No border");
        for (const frame of frames) {
            frameChoice(row, rows[rowId], frame.id, frame.name);
        }
        if (state.frameImage) {
            frameChoice(row, rows[rowId], "custom", "Your frame");
        }
    }
}

// ---------- The library on the left ----------

// Whether a background (a preset, a saved image, or "none" for Claude's own) is
// the one showing on the main page or the sidebar.
function usedOn(place, kind, id) {
    if (place === "sidebar") {
        if (id === "none") {
            return state.sidebarMode === "plain";
        }
        if (state.sidebarMode !== "own") {
            return false;
        }
        return kind === "preset" ? state.sidebarPreset === id : !state.sidebarPreset && state.sidebarImageId === id;
    }
    return kind === "preset" ? state.preset === id : !state.preset && state.imageId === id;
}

// Put a picture from the library onto a part of the screen. A side picture goes
// beside the chat, as one more picture there; anything else is a background, for
// the sidebar or the main page, in place of the one it had. Returns false when it
// could not be put there.
function usePicture(kind, id, zone) {
    if (kind === "sticker") {
        return placePicture(id, sides.includes(zone) ? zone : lastSide);
    }
    if (zone === "sidebar") {
        if (id === "none") {
            save({ sidebarMode: "plain" });
        } else if (kind === "preset") {
            save({ sidebarMode: "own", sidebarPreset: id, enabled: true });
        } else {
            const back = state.sidebarImageId === id ? {} : { sidebarShiftX: 0, sidebarShiftY: 0 };
            save({ sidebarMode: "own", sidebarPreset: null, sidebarImageId: id, enabled: true, ...back });
        }
        choose("sidebar");
    } else {
        // A different picture starts again on the automatic zoom, where its layout puts it.
        const zoom = state.imageId === id ? {} : { imageZoom: null, imageShiftX: 0, imageShiftY: 0 };
        save(kind === "preset" ? { preset: id, enabled: true } : { preset: null, imageId: id, enabled: true, ...zoom });
        choose("main");
    }
    return true;
}

// One picture in the library. It can be clicked, or dragged onto the screen.
function tile(kind, id, name, background) {
    const button = document.createElement("button");
    button.className = "tile";
    button.draggable = true;
    button.dataset.kind = kind;
    button.dataset.id = id;
    button.style.backgroundImage = background;

    if (name) {
        const label = document.createElement("span");
        label.textContent = name;
        button.appendChild(label);
    }

    button.addEventListener("click", () => {
        usePicture(kind, id, part);
    });
    button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", name || "picture");
        event.dataTransfer.effectAllowed = "copy";
        startDragging({ kind: kind, id: id });
    });
    button.addEventListener("dragend", stopDragging);
    return button;
}

// A tile with a small cross to remove it.
// Ask a yes-or-no question in a small box of the editor's own, and wait for the
// answer: true for yes. The browser's own question box is not used, because Chrome
// can refuse to show one from a page that is framed inside another site's page,
// which is how the editor sits on claude.ai. `yes` is the wording of the yes button.
function ask(question, yes) {
    return new Promise((answer) => {
        const box = byId("ask");
        byId("ask-text").textContent = question;
        byId("ask-yes").textContent = yes;
        box.hidden = false;
        // Enter on a question should never be the answer that cannot be taken back.
        const asker = document.activeElement;
        byId("ask-no").focus();

        const finish = (said) => {
            box.hidden = true;
            byId("ask-yes").removeEventListener("click", agreed);
            byId("ask-no").removeEventListener("click", refused);
            document.removeEventListener("keydown", escaped, true);
            if (asker && asker.isConnected) {
                asker.focus();
            }
            answer(said);
        };
        const agreed = () => finish(true);
        const refused = () => finish(false);
        // Esc answers no, and goes no further: it must not close the editor too.
        const escaped = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                event.preventDefault();
                finish(false);
            }
        };
        byId("ask-yes").addEventListener("click", agreed);
        byId("ask-no").addEventListener("click", refused);
        document.addEventListener("keydown", escaped, true);
    });
}

function removable(button, title, remove) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const cross = document.createElement("button");
    cross.className = "remove";
    cross.textContent = "×";
    cross.title = title;
    cross.setAttribute("aria-label", title);
    cross.addEventListener("click", remove);

    cell.append(button, cross);
    return cell;
}

async function removeImage(id) {
    if (!(await ask("Remove this image from your saved images?", "Remove"))) {
        return;
    }
    const change = { images: state.images.filter((image) => image.id !== id) };

    // If it was the main page's background, go back to the first preset.
    if (!state.preset && state.imageId === id) {
        change.preset = defaults.preset;
        change.imageId = null;
    }
    // The same for the sidebar's own picture.
    if (!state.sidebarPreset && state.sidebarImageId === id) {
        change.sidebarPreset = defaults.sidebarPreset;
        change.sidebarImageId = null;
    }
    forgetHistory();
    save(change, "none");
    await chrome.storage.local.remove(imageKey(id));
    showLibrary();
}

async function removeSticker(id) {
    const shows = (item) => item.id === id;
    const question = "Remove this picture from your saved pictures?" + (state.placed.some(shows) ? " It will be taken off the page too." : "");
    if (!(await ask(question, "Remove"))) {
        return;
    }
    const change = { stickers: state.stickers.filter((sticker) => sticker.id !== id) };

    // Every copy of it that is on the page goes too.
    if (state.placed.some(shows)) {
        change.placed = state.placed.filter((item) => !shows(item));
    }
    forgetHistory();
    save(change, "none");
    await chrome.storage.local.remove(stickerKey(id));
    showLibrary();
}

// The row of the selected side's pictures in its settings, the front one first,
// with the chosen one marked. It is drawn again only when the pictures in it
// change, so that the keyboard keeps its place in it while a slider moves.
let rowShows = "";
function showPlaced(picked) {
    const row = byId("side-placed");
    const here = placedOn(part).reverse();
    const thumb = (item) => (state.stickers.find((sticker) => sticker.id === item.id) || {}).thumb;
    const shows = here.map((item) => item.key + " " + item.id + (thumb(item) ? "" : " unseen")).join(", ");

    if (shows !== rowShows) {
        rowShows = shows;
        row.replaceChildren(...here.map((item, index) => {
            const button = document.createElement("button");
            button.className = "tile";
            button.dataset.key = item.key;
            button.setAttribute("aria-label", `Picture ${index + 1} of ${here.length}, counted from the front`);
            if (thumb(item)) {
                button.style.backgroundImage = `url("${thumb(item)}")`;
            }
            // The two ends of the row say which way it runs.
            if (here.length > 1 && (index === 0 || index === here.length - 1)) {
                const label = document.createElement("span");
                label.textContent = index === 0 ? "Front" : "Back";
                button.appendChild(label);
            }
            button.addEventListener("click", () => {
                chosen[item.side] = item.key;
                choose(item.side);
            });
            return button;
        }));
    }
    for (const button of row.children) {
        press(button, picked !== null && button.dataset.key === picked.key);
    }
}

// Draw the library again: the presets, the saved images and the side pictures.
function showLibrary() {
    const presetRow = byId("presets");
    presetRow.replaceChildren();
    for (const preset of presets) {
        const button = tile("preset", preset.id, preset.name, preset.css);
        button.classList.toggle("light", preset.light === true);
        presetRow.appendChild(button);
    }
    // No background at all: Claude looks the way it normally does.
    const plain = tile("preset", "none", "Claude's own", "none");
    plain.classList.add("plain");
    presetRow.appendChild(plain);

    const imageRow = byId("images");
    imageRow.replaceChildren();
    for (const image of state.images) {
        const button = tile("image", image.id, image.animated ? "GIF" : "", `url("${image.thumb}")`);
        button.title = "Click to use it, or drag it onto the screen";
        imageRow.appendChild(removable(button, "Remove this image", () => removeImage(image.id)));
    }
    byId("images-empty").hidden = state.images.length > 0;

    const stickerRow = byId("stickers");
    stickerRow.replaceChildren();
    for (const sticker of state.stickers) {
        const button = tile("sticker", sticker.id, "", `url("${sticker.thumb}")`);
        button.title = "Click to add it beside the chat, or drag it there";
        stickerRow.appendChild(removable(button, "Remove this picture", () => removeSticker(sticker.id)));
    }
    byId("stickers-empty").hidden = state.stickers.length > 0;
}

// ---------- Adding pictures from the computer ----------

function readFile(file) {
    return new Promise((done, failed) => {
        const reader = new FileReader();
        reader.onload = () => done(reader.result);
        reader.onerror = () => failed(new Error("That file could not be read."));
        reader.readAsDataURL(file);
    });
}

function openPicture(source) {
    return new Promise((done, failed) => {
        const picture = new Image();
        picture.onload = () => done(picture);
        picture.onerror = () => failed(new Error("That file could not be opened as an image."));
        picture.src = source;
    });
}

// A copy of a picture as stored text, shrunk so that neither side is over `longest`.
function drawn(picture, longest, type, quality) {
    const shrink = Math.min(1, longest / Math.max(picture.naturalWidth, picture.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * shrink));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * shrink));
    const context = canvas.getContext("2d");
    // JPEG has no see-through parts; give them white rather than black.
    if (type === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type, quality);
}

// Keep a file as a background image and return its id. Each saved picture gets an
// id of its own, so earlier ones are kept. A still picture is shrunk to what the
// largest screens need; the page fits it to its space. A GIF is kept exactly as it
// is, so that it keeps moving.
async function keepImage(file) {
    const animated = file.type === "image/gif";
    if (animated && file.size > maxMovingBytes) {
        throw new Error("That GIF is over 25 MB. Please choose a smaller one.");
    }
    const data = await readFile(file);
    const picture = await openPicture(data);
    const id = newId();
    const saved = await chrome.storage.local.get({ images: [] });

    await chrome.storage.local.set({
        [imageKey(id)]: animated ? data : drawn(picture, maxSavedWidth, "image/jpeg", 0.85),
        images: [...saved.images, { id: id, thumb: drawn(picture, 240, "image/jpeg", 0.7), animated: animated }]
    });
    return id;
}

// Keep a file as a side picture and return its id. It is stored exactly as it
// is, so a see-through PNG stays see-through and a GIF keeps moving.
async function keepSticker(file) {
    if (file.size > maxStickerBytes) {
        throw new Error("That file is over 12 MB. Please choose a smaller one.");
    }
    const data = await readFile(file);
    const picture = await openPicture(data);
    const id = newId();
    const saved = await chrome.storage.local.get({ stickers: [] });

    await chrome.storage.local.set({
        [stickerKey(id)]: data,
        stickers: [...saved.stickers, { id: id, thumb: drawn(picture, 96, "image/png") }]
    });
    return id;
}

// Add files for one part of the screen. They are all kept in the library; with
// `use`, the first one is also put on that part straight away.
async function addFiles(files, zone, use) {
    const pictures = [...files].filter((file) => file.type.startsWith("image/"));
    if (pictures.length === 0) {
        say("Only pictures can be added: PNG, JPEG, GIF or WebP files.");
        return;
    }
    const beside = sides.includes(zone);
    let kept = 0;
    let used = true;
    let problem = "";
    say(pictures.length > 1 ? `Adding ${pictures.length} pictures…` : "Adding the picture…");

    for (const file of pictures) {
        try {
            const id = beside ? await keepSticker(file) : await keepImage(file);
            if (use && kept === 0) {
                used = usePicture(beside ? "sticker" : "image", id, zone);
            }
            kept++;
        } catch (error) {
            problem = error.message;
        }
    }

    const shelf = beside ? "Side pictures" : "Your images";
    if (problem) {
        say(kept > 0 ? `${problem} The others were added.` : problem);
    } else if (!used) {
        say(`Kept under ${shelf}, but not put on the page. ${noRoom}`);
    } else {
        say(kept > 1 ? `Added ${kept} pictures. They are kept under ${shelf}.` : `Added. It is kept under ${shelf}.`);
    }
}

// ---------- Dragging ----------

function startDragging(what) {
    dragged = what;
    document.body.classList.add("dragging", "dragging-" + (what.kind === "preset" ? "image" : what.kind));
}

function stopDragging() {
    dragged = null;
    document.body.classList.remove("dragging", "dragging-files", "dragging-image", "dragging-sticker");
    for (const element of document.querySelectorAll(".over")) {
        element.classList.remove("over");
    }
}

// Whether a part of the screen takes what is being dragged. Files from the
// computer can go anywhere; a side picture only beside the chat, and a
// background only on the main page or the sidebar.
function takes(zone) {
    if (!dragged) {
        return false;
    }
    return dragged.kind === "files" || (dragged.kind === "sticker") === sides.includes(zone);
}

function watchDrops() {
    // Files dragged in from the computer.
    document.addEventListener("dragenter", (event) => {
        if (!dragged && event.dataTransfer.types.includes("Files")) {
            startDragging({ kind: "files" });
        }
    });
    // Anywhere that has not already taken it: nothing can be dropped here. Without
    // this the browser would open a dropped file in place of the editor.
    document.addEventListener("dragover", (event) => {
        if (dragged && !event.defaultPrevented) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "none";
        }
    });
    document.addEventListener("dragleave", (event) => {
        if (dragged && dragged.kind === "files" && !event.relatedTarget) {
            stopDragging();
        }
    });
    document.addEventListener("drop", (event) => {
        event.preventDefault();
        if (dragged) {
            say("Drop it on the main page, the sidebar, or beside the chat.");
        }
        stopDragging();
    });

    for (const zone of document.querySelectorAll(".zone")) {
        const name = zone.dataset.zone;

        zone.addEventListener("click", () => {
            choose(name);
        });
        zone.addEventListener("dragover", (event) => {
            if (takes(name)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                zone.classList.add("over");
            }
        });
        zone.addEventListener("dragleave", () => {
            zone.classList.remove("over");
        });
        zone.addEventListener("drop", (event) => {
            if (!takes(name)) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const what = dragged;
            stopDragging();
            if (what.kind === "files") {
                addFiles(event.dataTransfer.files, name, true);
            } else {
                usePicture(what.kind, what.id, name);
            }
        });
    }

    // Files dropped on the library are kept there without being used anywhere.
    for (const shelf of document.querySelectorAll("[data-takes]")) {
        shelf.addEventListener("dragover", (event) => {
            if (dragged && dragged.kind === "files") {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                shelf.classList.add("over");
            }
        });
        shelf.addEventListener("dragleave", () => {
            shelf.classList.remove("over");
        });
        shelf.addEventListener("drop", (event) => {
            if (!dragged || dragged.kind !== "files") {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            stopDragging();
            addFiles(event.dataTransfer.files, shelf.dataset.takes === "sticker" ? lastSide : "main", false);
        });
    }
}

// ---------- The screen in the middle ----------

// One of the preview's elements, or null while the preview is still loading.
function inPreview(selector) {
    const page = preview.contentDocument;
    return page ? page.querySelector(selector) : null;
}

// Where the parts of the page are: the sidebar, the chat window (`pane`), the
// column the messages sit in and, in `placed`, each picture beside the chat, under
// its key. Each is { left, top, width, height }, or null when it is not showing.
// Over the real page, content.js measures them and sends them here; in a tab, they
// are measured in the preview.
function measure() {
    if (onPage) {
        return pageBoxes;
    }
    const box = (element) => {
        if (!element || element.style.display === "none") {
            return null;
        }
        const found = element.getBoundingClientRect();
        return { left: found.left, top: found.top, width: found.width, height: found.height };
    };
    const page = preview.contentDocument;
    const placed = {};
    for (const element of page ? page.querySelectorAll(".claude-sticker") : []) {
        placed[element.dataset.key] = box(element);
    }
    return {
        sidebar: box(inPreview(".dframe-sidebar")),
        pane: box(inPreview(".dframe-pane-primary")),
        column: box(inPreview('[data-cds="ChatComposer"]')),
        placed: placed
    };
}

// Lay an element of the editor over one of those boxes, or hide it when there is none.
function cover(element, box) {
    element.hidden = !box || box.width <= 0 || box.height <= 0;
    if (!element.hidden) {
        const style = element.style;
        style.left = box.left * scale + "px";
        style.top = box.top * scale + "px";
        style.width = box.width * scale + "px";
        style.height = box.height * scale + "px";
    }
}

// Lay the selectable parts over the page. In a tab, the preview is first fitted
// into the space it has. The side pictures move when a setting changes, so this
// runs on a timer too.
function layout() {
    if (!onPage) {
        scale = clamp(Math.min((stage.clientWidth - 24) / screenWidth, (stage.clientHeight - 24) / screenHeight), 0.2, 1);
        preview.style.width = screenWidth + "px";
        preview.style.height = screenHeight + "px";
        preview.style.transform = `scale(${scale})`;
        screenBox.style.width = screenWidth * scale + "px";
        screenBox.style.height = screenHeight * scale + "px";
    }

    const boxes = measure() || {};
    const pane = boxes.pane;
    const column = boxes.column;

    // Until they are moved, the bar and the library sit over the middle of the
    // chat, clear of the sidebar and of the space on either side.
    if (column) {
        const edge = onPage ? 0 : screenBox.getBoundingClientRect().left;
        document.body.style.setProperty("--middle", edge + (column.left + column.width / 2) * scale + "px");
        document.body.style.setProperty("--column", column.width * scale + "px");
        // The library starts at the column's left edge and stops short of the
        // settings, which start at the right, so neither covers the other. On a
        // window too narrow for that it keeps a width it can be used at.
        const left = edge + column.left * scale;
        const width = Math.min(column.width * scale, Math.max(420, innerWidth - settingsSpace - left));
        document.body.style.setProperty("--library-middle", left + width / 2 + "px");
        document.body.style.setProperty("--library-width", width + "px");
    }

    cover(byId("zone-sidebar"), boxes.sidebar);
    cover(byId("zone-main"), pane);
    // The empty space on each side of the chat, below the title bar.
    const beside = pane && column;
    cover(byId("zone-left"), beside && {
        left: pane.left, top: pane.top + 48, width: column.left - pane.left, height: pane.height - 48
    });
    cover(byId("zone-right"), beside && {
        left: column.left + column.width, top: pane.top + 48,
        width: pane.left + pane.width - column.left - column.width, height: pane.height - 48
    });

    // A grip over each picture beside the chat. They are stacked as the pictures
    // are, so that a press lands on the one in front.
    const shown = boxes.placed || {};
    for (const [key, grip] of grips) {
        if (!state.placed.some((item) => item.key === key)) {
            grip.remove();
            grips.delete(key);
        }
    }
    state.placed.forEach((item, index) => {
        if (!grips.has(item.key)) {
            grips.set(item.key, makeGrip(item.key));
        }
        const grip = grips.get(item.key);
        cover(grip, state.enabled && shown[item.key]);
        grip.style.zIndex = index + 1;
        grip.dataset.side = item.side;
        grip.classList.toggle("selected", part === item.side && chosenOn(item.side) === item);
    });
    showStage(boxes.sidebar);
}

// The main picture's space: the whole window when the sidebar is joined to the
// main background or is closed, and otherwise the chat window, which is what is
// left to the right of the sidebar. content.js works out the same space when it
// lays the picture out. `sidebar` is the sidebar's box, or null.
function stageSize(sidebar) {
    const width = onPage ? window.innerWidth : screenWidth;
    const height = onPage ? window.innerHeight : screenHeight;
    const beside = state.sidebarMode !== "joined" && sidebar && sidebar.width > 0;
    return { width: beside ? width - sidebar.left - sidebar.width : width, height: height, beside: Boolean(beside) };
}

// Say how big that space is, in the note under the Zoom slider.
function showStage(sidebar) {
    const size = stageSize(sidebar);
    const text = (size.beside ? "the chat window, " : "the whole window, ") +
        Math.ceil(size.width) + " \u00d7 " + Math.ceil(size.height);
    if (byId("stage-size").textContent !== text) {
        byId("stage-size").textContent = text;
    }
}

// Whether the main page, or the sidebar, is showing a saved image that can be
// dragged. A preset is a wash of colour and has nowhere to go.
function pans(name) {
    if (!state.enabled) {
        return false;
    }
    return name === "sidebar"
        ? state.sidebarMode === "own" && state.sidebarPreset === null && state.sidebarImageId !== null
        : state.preset === null && state.imageId !== null;
}

// Dragging the main page or the sidebar on the screen moves its picture. How far
// is kept as a share of the size of the picture's space, so that it comes out the
// same in a window of another size. A press that does not move is still a click.
function watchPan(name, xKey, yKey) {
    const zone = byId("zone-" + name);
    let start = null;

    zone.addEventListener("pointerdown", (event) => {
        const sidebar = (measure() || {}).sidebar;
        const room = name === "sidebar" ? sidebar : stageSize(sidebar);
        if (event.button !== 0 || !pans(name) || !room || !room.width || !room.height) {
            return;
        }
        start = {
            x: event.clientX, y: event.clientY, moved: false,
            shiftX: state[xKey], shiftY: state[yKey], width: room.width, height: room.height
        };
        try {
            zone.setPointerCapture(event.pointerId);
        } catch (error) {
            // Nothing to do.
        }
    });

    zone.addEventListener("pointermove", (event) => {
        if (!start) {
            return;
        }
        const across = (event.clientX - start.x) / scale;
        const down = (event.clientY - start.y) / scale;
        if (!start.moved && Math.hypot(across, down) < 4) {
            return;
        }
        if (!start.moved && part !== name) {
            choose(name);
        }
        start.moved = true;
        // To a thousandth, and never more than one whole space away.
        const share = (from, moved, size) => clamp(Math.round((from + moved / size) * 1000) / 1000, -1, 1);
        save({
            [xKey]: share(start.shiftX, across, start.width),
            [yKey]: share(start.shiftY, down, start.height)
        }, "flow");
    });

    for (const ending of ["pointerup", "pointercancel"]) {
        zone.addEventListener(ending, () => {
            start = null;
        });
    }
}

// The grip over each picture beside the chat, under the picture's key.
const grips = new Map();

function makeGrip(key) {
    const grip = document.createElement("div");
    grip.className = "grip";
    grip.hidden = true;
    const handle = document.createElement("i");
    handle.className = "handle";
    grip.appendChild(handle);
    byId("overlay").appendChild(grip);
    watchGrip(grip, key);
    return grip;
}

// Dragging a side picture on the screen moves it, up and down and sideways within
// the chat window; dragging the corner nearest the chat resizes it.
function watchGrip(grip, key) {
    let start = null;

    grip.addEventListener("pointerdown", (event) => {
        const item = state.placed.find((other) => other.key === key);
        // Taken off the page a moment ago; its grip is about to go too.
        if (!item) {
            return;
        }
        // A picture can be picked up straight away; that chooses it, and selects its side.
        const side = item.side;
        chosen[side] = key;
        choose(side);
        const boxes = measure() || {};
        const box = (boxes.placed || {})[key];
        const pane = boxes.pane;
        const column = boxes.column;
        if (!box || !pane || !column) {
            return;
        }

        // These match placeStickers in content.js: the picture stays below the
        // 56px title bar and 12px clear of the edges. `usual` is where it sits
        // sideways when it has not been dragged: in the middle of the empty space,
        // or from the window's edge when it is wider than that.
        const room = (side === "left" ? column.left - pane.left : pane.left + pane.width - column.left - column.width) - 24;
        const beside = Math.max(0, room - box.width) / 2;
        start = {
            x: event.clientX,
            y: event.clientY,
            top: box.top,
            left: box.left,
            width: box.width,
            side: side,
            resizing: event.target.classList.contains("handle"),
            highest: pane.top + 56,
            spare: pane.height - 56 - 12 - box.height,
            room: room,
            usual: side === "left" ? pane.left + 12 + beside : pane.left + pane.width - 12 - beside - box.width,
            leftmost: pane.left + 12,
            rightmost: pane.left + pane.width - 12 - box.width
        };
        // Keeps the drag going when the pointer leaves the picture. A pointer
        // that cannot be captured still drags while it is over the picture.
        try {
            grip.setPointerCapture(event.pointerId);
        } catch (error) {
            // Nothing to do.
        }
        event.preventDefault();
    });

    grip.addEventListener("pointermove", (event) => {
        if (!start) {
            return;
        }
        const across = (event.clientX - start.x) / scale;
        const down = (event.clientY - start.y) / scale;

        if (start.resizing) {
            // A picture that fits its space is centred there, so it grows on both sides.
            const towardsChat = start.side === "left" ? across : -across;
            const grown = start.width < start.room ? towardsChat * 2 : towardsChat;
            changePlaced(key, { size: clamp(Math.round(start.width + grown), ...placedLimits.size) }, "flow");
        } else {
            // Sideways anywhere in the chat window; up and down as far as there is
            // room. A direction it has not been moved in is left as it was.
            start.across = start.across || across !== 0;
            start.down = start.down || down !== 0;
            const change = {};
            if (start.across) {
                change.shift = Math.round(clamp(start.left + across, start.leftmost, start.rightmost) - start.usual);
            }
            if (start.down && start.spare > 0) {
                const share = (start.top + down - start.highest) / start.spare;
                change.position = clamp(Math.round(share * 100), ...placedLimits.position);
            }
            if (Object.keys(change).length > 0) {
                changePlaced(key, change, "flow");
            }
        }
    });

    for (const ending of ["pointerup", "pointercancel"]) {
        grip.addEventListener(ending, () => {
            start = null;
        });
    }
}

// ---------- The windows ----------

// The bar, the library and the settings are small windows over the page. Each is
// moved by its title bar and, apart from the bar, resized by its edges and
// corners; the three dots in a title bar close it, fold it away to its title bar,
// and put it back where it started. `windows` holds what has been done to each:
// { left, top, width, height, folded, closed }. A window that has never been moved
// has no `left`, and sits where the stylesheet puts it.
const windowIds = ["bar", "library", "inspector"];
const smallest = { width: 220, height: 120 };
// What the settings take up at the right when they have not been moved: their
// width, their gap from the edge and a gap beside them (see #inspector in editor.css).
const settingsSpace = 312 + 12 + 12;
let windows = {};
let front = 2;

function keepWindows() {
    chrome.storage.local.set({ editorWindows: windows });
}

// Show a window the way `windows` says: its place, its size, folded or closed.
function placeWindow(id) {
    const element = byId(id);
    const kept = windows[id] || {};
    const style = element.style;
    const moved = kept.left !== undefined;
    const sized = kept.width !== undefined && !kept.folded;

    element.hidden = kept.closed === true;
    element.classList.toggle("folded", kept.folded === true);
    element.classList.toggle("moved", moved);

    if (moved) {
        // Never so far off the edge that its title bar cannot be reached.
        const width = sized ? kept.width : element.offsetWidth;
        style.left = clamp(kept.left, 80 - width, innerWidth - 80) + "px";
        style.top = clamp(kept.top, 0, innerHeight - 36) + "px";
        style.right = "auto";
        style.bottom = "auto";
        style.transform = "none";
    } else {
        style.left = style.top = style.right = style.bottom = style.transform = "";
    }
    if (sized) {
        style.width = kept.width + "px";
        style.height = kept.height + "px";
        style.maxHeight = "none";
    } else {
        style.width = style.height = "";
        // A moved window that has not been given a size is as tall as its
        // contents, down to the bottom of the browser window at most.
        style.maxHeight = moved && !kept.folded ? Math.max(smallest.height, innerHeight - parseFloat(style.top) - 12) + "px" : "";
    }
}

function placeWindows() {
    for (const id of windowIds) {
        placeWindow(id);
    }
    for (const id of ["library", "inspector"]) {
        press(byId("show-" + id), !(windows[id] && windows[id].closed));
    }
}

// Change what is kept about one window, and show it.
function changeWindow(id, change) {
    windows[id] = { ...windows[id], ...change };
    placeWindows();
}

// Follow the pointer from a press on `handle` until it is let go. `moved` is told
// how far it has gone each time, and `done` when it stops.
function followPointer(handle, begin, moved, done) {
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || begin(event) === false) {
            return;
        }
        start = { x: event.clientX, y: event.clientY };
        // Keeps the drag going when the pointer leaves the handle.
        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            // Nothing to do.
        }
        event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
        if (start) {
            moved(event.clientX - start.x, event.clientY - start.y);
        }
    });
    for (const ending of ["pointerup", "pointercancel"]) {
        handle.addEventListener(ending, () => {
            if (start) {
                start = null;
                done();
            }
        });
    }
}

// Give a window its title bar and its edges, and make them work. The bar has
// neither: it is moved by any part of it that is not a button.
function makeWindow(id) {
    const element = byId(id);
    let box = null;

    // A press anywhere on a window brings it in front of the others.
    element.addEventListener("pointerdown", () => {
        element.style.zIndex = ++front;
    }, true);

    let grab = element;
    if (id !== "bar") {
        grab = document.createElement("div");
        grab.className = "titlebar";
        grab.title = "Drag to move";

        const lights = document.createElement("span");
        lights.className = "lights";
        const light = (name, title, act) => {
            const button = document.createElement("button");
            button.className = name;
            button.title = title;
            button.setAttribute("aria-label", title);
            button.addEventListener("click", act);
            lights.appendChild(button);
        };
        light("shut", "Close this window. The bar at the top brings it back", () => {
            changeWindow(id, { closed: true });
            keepWindows();
        });
        light("fold", "Fold away to the title bar, or unfold", () => {
            changeWindow(id, { folded: !(windows[id] && windows[id].folded) });
            keepWindows();
        });
        light("home", "Put back where it started, at its first size", () => {
            windows[id] = {};
            placeWindows();
            keepWindows();
        });

        element.setAttribute("aria-label", element.dataset.name);
        const name = document.createElement("b");
        name.textContent = element.dataset.name;
        grab.append(lights, name);
        element.prepend(grab);

        // Eight places to resize from: four edges and four corners.
        for (const side of ["n", "e", "s", "w", "ne", "se", "sw", "nw"]) {
            const edge = document.createElement("i");
            edge.className = "edge " + side;
            followPointer(edge, () => {
                box = element.getBoundingClientRect();
            }, (across, down) => {
                let { left, top, width, height } = box;
                // An edge stops when the window is as small, or as big, as it may be.
                if (side.includes("e")) {
                    width = clamp(box.width + across, smallest.width, innerWidth);
                }
                if (side.includes("s")) {
                    height = clamp(box.height + down, smallest.height, innerHeight);
                }
                if (side.includes("w")) {
                    width = clamp(box.width - across, smallest.width, innerWidth);
                    left = box.right - width;
                }
                if (side.includes("n")) {
                    height = clamp(box.height - down, smallest.height, innerHeight);
                    top = box.bottom - height;
                }
                changeWindow(id, { left: left, top: top, width: Math.round(width), height: Math.round(height) });
            }, keepWindows);
            element.appendChild(edge);
        }
    }

    followPointer(grab, (event) => {
        // Buttons and other controls in a title bar are for pressing, not dragging.
        if (event.target.closest("button, input, select, a, label")) {
            return false;
        }
        box = element.getBoundingClientRect();
        document.body.classList.add("moving");
        return true;
    }, (across, down) => {
        changeWindow(id, { left: box.left + across, top: box.top + down });
    }, () => {
        document.body.classList.remove("moving");
        keepWindows();
    });
}

// Over the real page: close the editor. content.js takes it away.
function finish() {
    window.parent.postMessage({ claudeThemes: "close" }, "*");
}

// The preview's own light or dark mode. It changes nothing on claude.ai.
function showMode(dark) {
    // The preview may still be loading; it is asked again once it has.
    const page = preview.contentDocument;
    if (page && page.documentElement) {
        page.documentElement.classList.toggle("dark", dark);
    }
    press(byId("mode-light"), !dark);
    press(byId("mode-dark"), dark);
}

// ---------- Showing the current settings ----------

// The name of the background that is showing on the main page or the sidebar.
function backgroundName(presetId, imageId) {
    const preset = presets.find((item) => item.id === presetId);
    if (preset) {
        return preset.name;
    }
    if (presetId === "none") {
        return "Claude's own background";
    }
    const image = state.images.find((item) => item.id === imageId);
    return image && image.animated ? "one of your GIFs" : "one of your images";
}

function sync() {
    byId("enabled").checked = state.enabled;
    for (const update of updaters) {
        update();
    }

    for (const name of parts) {
        press(byId("part-" + name), name === part);
        byId("zone-" + name).classList.toggle("selected", name === part);
    }
    for (const side of sides) {
        byId("zone-" + side).classList.toggle("bare", placedOn(side).length === 0);
    }
    // Over the real page the settings float; they move to the left when the
    // right-hand side is selected, so they never cover the part being changed.
    document.body.classList.toggle("dock-left", part === "right");
    byId("panel-main").hidden = part !== "main";
    byId("panel-sidebar").hidden = part !== "sidebar";
    // A side's settings are those of the picture that is chosen there.
    const picked = chosenOn(part);
    byId("panel-side").hidden = !sides.includes(part);
    byId("side-title").textContent = part === "left" ? "Pictures on the left" : "Pictures on the right";
    byId("side-empty").hidden = picked !== null;
    byId("side-chosen").hidden = picked === null;
    showPlaced(picked);
    for (const how of Object.keys(layerMoves)) {
        byId("layer-" + how).disabled = picked === null || relayered(state.placed, picked.key, how) === null;
    }

    byId("main-now").textContent = backgroundName(state.preset, state.imageId);
    byId("side-now").textContent = backgroundName(state.sidebarPreset, state.sidebarImageId);
    // Zoom is for a saved image. A preset is a wash of colour with no size of its own.
    byId("zoom-main").hidden = state.preset !== null;
    byId("zoom-side").hidden = state.sidebarPreset !== null;
    for (const name of ["main", "sidebar"]) {
        byId("zone-" + name).classList.toggle("pannable", pans(name));
    }
    byId("shift-reset").hidden = state.imageShiftX === 0 && state.imageShiftY === 0;
    byId("side-shift-reset").hidden = state.sidebarShiftX === 0 && state.sidebarShiftY === 0;
    byId("sticker-shift-reset").hidden = picked === null || picked.shift === 0;

    // The main page's frame goes around the chat window ("separate", which leaves
    // the sidebar free to have its own) or around the whole window ("combined").
    byId("separate").hidden = state.frameLayout !== "separate";
    byId("combined").hidden = state.frameLayout !== "combined";
    byId("side-combined").hidden = state.frameLayout !== "combined";
    for (const mode of ["joined", "own", "plain"]) {
        byId(mode).hidden = state.sidebarMode !== mode;
    }

    for (const button of document.querySelectorAll(".frame-choice")) {
        press(button, state[button.dataset.key] === button.dataset.frame);
    }

    // In the library, the picture in use on the selected part is marked.
    for (const button of document.querySelectorAll(".tile[data-kind]")) {
        const kind = button.dataset.kind;
        const id = button.dataset.id;
        if (kind === "sticker") {
            // On the selected side, or on either side when neither is selected.
            press(button, state.placed.some((item) => item.id === id && (item.side === part || !sides.includes(part))));
        } else {
            press(button, usedOn(part === "sidebar" ? "sidebar" : "main", kind, id));
        }
    }

    const goes = {
        main: "the main page's background",
        sidebar: "the sidebar's picture",
        left: "a picture on the left",
        right: "a picture on the right"
    };
    byId("browse-for").textContent = "The first one becomes " + goes[part] + ".";
    byId("undo").disabled = steps.length === 0;
    byId("redo").disabled = undoneSteps.length === 0;
}

async function start() {
    state = await readSettings();
    windows = (await chrome.storage.local.get({ editorWindows: {} })).editorWindows;

    // Chrome reads this page fresh from the folder each time, but keeps the page
    // script and the manifest it loaded earlier. A different version number means
    // the folder has changed since then.
    byId("stale").hidden = chrome.runtime.getManifest().version === filesVersion;

    // The main page.
    slider("opacity", "opacity", percent, fraction, hundredths);
    mainZoom();
    watchPan("main", "imageShiftX", "imageShiftY");
    watchPan("sidebar", "sidebarShiftX", "sidebarShiftY");
    byId("shift-reset").addEventListener("click", () => {
        save({ imageShiftX: 0, imageShiftY: 0 });
    });
    byId("side-shift-reset").addEventListener("click", () => {
        save({ sidebarShiftX: 0, sidebarShiftY: 0 });
    });
    byId("sticker-shift-reset").addEventListener("click", () => {
        const item = chosenOn(part);
        if (item) {
            changePlaced(item.key, { shift: 0 });
        }
    });
    colours("text-swatches", "text-color", "textColor", textSwatches, "#ffffff");
    colours("code-swatches", "code-color", "codeColor", codeSwatches, "#8e2626");
    fontChoice("font", "font-custom", "font", "fontCustom");
    oneOf("frameLayout", { separate: "layout-separate", combined: "layout-combined" });
    slider("frame-width", "frameWidth", pixels, same, same);

    // The sidebar.
    oneOf("sidebarMode", { joined: "side-joined", own: "side-own", plain: "side-plain" });
    slider("panel", "panelOpacity", percent, fraction, hundredths);
    slider("side-opacity", "sidebarOpacity", percent, fraction, hundredths);
    slider("side-zoom", "sidebarZoom", zoomed, zoomStored, hundredths);
    colours("side-text-swatches", "side-text-color", "sidebarTextColor", textSwatches, "#ffffff");
    fontChoice("side-font", "side-font-custom", "sidebarFont", "sidebarFontCustom");
    slider("frame-width-side", "frameSidebarWidth", pixels, same, same);

    // The pictures beside the chat.
    sideSlider("sticker-size", "size", pixels, same, same);
    sideSlider("sticker-position", "position", place, same, same);
    sideSlider("sticker-opacity", "opacity", percent, fraction, hundredths);
    for (const how of Object.keys(layerMoves)) {
        byId("layer-" + how).addEventListener("click", () => {
            const item = chosenOn(part);
            const list = item && relayered(state.placed, item.key, how);
            if (list) {
                // It stays the chosen one, even if it was only chosen for being in front.
                chosen[item.side] = item.key;
                save({ placed: list });
            }
        });
    }
    byId("side-remove").addEventListener("click", () => {
        const item = chosenOn(part);
        if (item) {
            removePlaced(item.key);
        }
    });

    showFrames();
    showLibrary();

    byId("enabled").addEventListener("change", () => {
        save({ enabled: byId("enabled").checked });
    });
    byId("undo").addEventListener("click", undo);
    byId("redo").addEventListener("click", redo);
    for (const name of parts) {
        byId("part-" + name).addEventListener("click", () => {
            choose(name);
        });
    }

    // The upload page crops a picture to the shape of the screen or the sidebar,
    // and reads an uploaded frame.
    byId("crop-main").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    });
    byId("crop-side").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html#sidebar") });
    });
    for (const id of ["choose-frame", "choose-frame-side"]) {
        byId(id).addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
    }

    byId("browse").addEventListener("click", () => {
        byId("files").click();
    });
    byId("files").addEventListener("change", (event) => {
        addFiles(event.target.files, part, true);
        event.target.value = "";
    });

    document.addEventListener("keydown", (event) => {
        const typing = event.target.matches && event.target.matches('input[type="text"], select');
        const command = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();

        if (command && key === "z" && !typing) {
            event.preventDefault();
            if (event.shiftKey) {
                redo();
            } else {
                undo();
            }
        } else if (command && key === "y" && !typing) {
            event.preventDefault();
            redo();
        } else if ((key === "delete" || key === "backspace") && !typing && chosenOn(part)) {
            removePlaced(chosenOn(part).key);
        }
    });

    watchDrops();

    for (const id of windowIds) {
        makeWindow(id);
    }
    for (const id of ["library", "inspector"]) {
        byId("show-" + id).addEventListener("click", () => {
            changeWindow(id, { closed: !(windows[id] && windows[id].closed) });
            keepWindows();
        });
    }
    placeWindows();
    // A smaller browser window may leave a window out of reach: bring it back in.
    window.addEventListener("resize", placeWindows);

    chrome.storage.onChanged.addListener((changes) => {
        for (const key of Object.keys(changes)) {
            // Full-size pictures are stored under their own keys; skip those.
            if (key in defaults) {
                state[key] = "newValue" in changes[key] ? changes[key].newValue : defaults[key];
            }
        }
        if ("images" in changes || "stickers" in changes) {
            showLibrary();
        }
        if ("frameImage" in changes || "frameSlice" in changes) {
            showFrames();
        }
        sync();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && onPage) {
            finish();
        }
    });

    if (onPage) {
        startOnPage();
    } else {
        startInTab();
    }

    window.addEventListener("resize", layout);
    setInterval(layout, 150);

    sync();
    layout();
}

// Laid over the real page: there is no preview, the panels float, and the page
// says where its parts are.
function startOnPage() {
    document.body.classList.add("on-page");
    preview.remove();
    for (const id of ["mode-light", "open-claude"]) {
        byId(id).closest(".pair, a").hidden = true;
    }
    byId("done").hidden = false;
    byId("add-how").textContent = "Drag pictures or GIFs from your computer onto the page, or";

    byId("done").addEventListener("click", finish);
    window.addEventListener("message", (event) => {
        if (event.source === window.parent && event.data && event.data.claudeThemes === "layout") {
            pageBoxes = event.data.boxes;
            byId("unfamiliar").hidden = event.data.unfamiliar !== true;
            byId("not-a-chat").hidden = event.data.plainPage !== true || event.data.unfamiliar === true;
            layout();
        }
    });
    // Tell the page this editor is ready for its measurements.
    window.parent.postMessage({ claudeThemes: "ready" }, "*");
}

// In a tab of its own, with the preview in the middle.
function startInTab() {
    // The toolbar icon could not open the editor on the Claude tab itself.
    byId("refresh").hidden = asked.get("why") !== "refresh";

    // The preview starts in the mode the computer is in.
    let dark = matchMedia("(prefers-color-scheme: dark)").matches;
    byId("mode-light").addEventListener("click", () => {
        dark = false;
        showMode(dark);
    });
    byId("mode-dark").addEventListener("click", () => {
        dark = true;
        showMode(dark);
    });
    preview.addEventListener("load", () => {
        showMode(dark);
        layout();
    });
    // Only fetched here: over the real page there is no preview.
    preview.src = preview.dataset.src;
    showMode(dark);
}

start();
