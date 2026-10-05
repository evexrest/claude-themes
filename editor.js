// The editor: one full page. In the middle is a stand-in for claude.ai (preview.html)
// with the theme applied, on the left the pictures to choose from, on the right the
// settings of the part that is selected. Every change is saved straight away; the
// preview and any open claude.ai tab pick it up from storage. `defaults`, `presets`,
// `frames`, `frameValues`, `fonts`, `imageKey`, `stickerKey` and `filesVersion` come
// from settings.js.

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

// The parts of the screen that can be selected, and the setting that holds each
// side's picture.
const parts = ["main", "sidebar", "left", "right"];
const sideKeys = { left: "stickerLeft", right: "stickerRight" };

// The preview is drawn at the size of a real browser window, then shrunk to fit.
// The address can ask for another size: editor.html?w=1512&h=860.
const asked = new URLSearchParams(location.search);
const screenWidth = Number(asked.get("w")) || Math.min(2200, Math.max(1200, screen.availWidth));
const screenHeight = Number(asked.get("h")) || Math.min(1400, Math.max(700, screen.availHeight - 90));

let state = { ...defaults };
let part = "main";
// The side a side picture goes to when neither side is selected.
let lastSide = "right";
let scale = 1;
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
// make one step, and "none" is left out.
function save(change, how = "step") {
    if (how !== "none") {
        remember(change, how === "flow");
    }
    Object.assign(state, change);
    chrome.storage.local.set(change);
    sync();
}

function remember(change, flowing) {
    const keys = Object.keys(change).sort().join(" ");
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
    if (name in sideKeys) {
        lastSide = name;
    }
    sync();
    layout();
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

const percent = (number) => number + "%";
const pixels = (number) => number + "px";
const fraction = (number) => number / 100;
const hundredths = (number) => Math.round(number * 100);
const same = (number) => number;
const place = (number) => number < 20 ? "Top" : number > 80 ? "Bottom" : "Middle";

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
// beside the chat; anything else is a background, for the sidebar or the main page.
function usePicture(kind, id, zone) {
    if (kind === "sticker") {
        const side = zone in sideKeys ? zone : lastSide;
        save({ [sideKeys[side]]: id, enabled: true });
        choose(side);
    } else if (zone === "sidebar") {
        if (id === "none") {
            save({ sidebarMode: "plain" });
        } else if (kind === "preset") {
            save({ sidebarMode: "own", sidebarPreset: id, enabled: true });
        } else {
            save({ sidebarMode: "own", sidebarPreset: null, sidebarImageId: id, enabled: true });
        }
        choose("sidebar");
    } else {
        save(kind === "preset" ? { preset: id, enabled: true } : { preset: null, imageId: id, enabled: true });
        choose("main");
    }
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
function removable(button, title, remove) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const cross = document.createElement("button");
    cross.className = "remove";
    cross.textContent = "×";
    cross.title = title;
    cross.addEventListener("click", remove);

    cell.append(button, cross);
    return cell;
}

async function removeImage(id) {
    if (!confirm("Remove this image from your saved images?")) {
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
    if (!confirm("Remove this picture from your saved pictures?")) {
        return;
    }
    const change = { stickers: state.stickers.filter((sticker) => sticker.id !== id) };

    // Take it off whichever side was showing it.
    for (const key of Object.values(sideKeys)) {
        if (state[key] === id) {
            change[key] = null;
        }
    }
    forgetHistory();
    save(change, "none");
    await chrome.storage.local.remove(stickerKey(id));
    showLibrary();
}

// Draw the library again: the presets, the saved images and the side pictures.
function showLibrary() {
    const presetRow = byId("presets");
    presetRow.replaceChildren();
    for (const preset of presets) {
        presetRow.appendChild(tile("preset", preset.id, preset.name, preset.css));
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
        button.title = "Click to use it, or drag it beside the chat";
        stickerRow.appendChild(removable(button, "Remove this picture", () => removeSticker(sticker.id)));
    }
    byId("stickers-empty").hidden = state.stickers.length > 0;

    // The same pictures again in the side's own panel, with "None" first.
    const sideRow = byId("side-choices");
    sideRow.replaceChildren();
    for (const sticker of [{ id: null, thumb: null }, ...state.stickers]) {
        const button = document.createElement("button");
        button.className = "tile";
        button.dataset.side = sticker.id === null ? "" : sticker.id;
        if (sticker.thumb) {
            button.style.backgroundImage = `url("${sticker.thumb}")`;
        } else {
            button.textContent = "None";
        }
        button.addEventListener("click", () => {
            save({ [sideKeys[part]]: sticker.id, enabled: true });
        });
        sideRow.appendChild(button);
    }
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

// Each saved picture gets its own id, so earlier ones are kept.
let made = 0;
function newId() {
    return Date.now().toString(36) + (made++).toString(36);
}

// Keep a file as a background image and return its id. A still picture is shrunk
// to what the largest screens need; the page fits it to its space. A GIF is kept
// exactly as it is, so that it keeps moving.
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
    const beside = zone in sideKeys;
    let kept = 0;
    let problem = "";
    say(pictures.length > 1 ? `Adding ${pictures.length} pictures…` : "Adding the picture…");

    for (const file of pictures) {
        try {
            const id = beside ? await keepSticker(file) : await keepImage(file);
            if (use && kept === 0) {
                usePicture(beside ? "sticker" : "image", id, zone);
            }
            kept++;
        } catch (error) {
            problem = error.message;
        }
    }

    const shelf = beside ? "Side pictures" : "Your images";
    if (problem) {
        say(kept > 0 ? `${problem} The others were added.` : problem);
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
    return dragged.kind === "files" || (dragged.kind === "sticker") === (zone in sideKeys);
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
            say("Drop it on the screen: on the main page, the sidebar, or beside the chat.");
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

// Lay an element of the editor over a box measured inside the preview.
function cover(element, left, top, width, height) {
    const style = element.style;
    style.left = left * scale + "px";
    style.top = top * scale + "px";
    style.width = Math.max(0, width) * scale + "px";
    style.height = Math.max(0, height) * scale + "px";
}

// Fit the preview into the space it has, and lay the selectable parts over it.
// The side pictures move when a setting changes, so this runs on a timer too.
function layout() {
    scale = clamp(Math.min((stage.clientWidth - 48) / screenWidth, (stage.clientHeight - 96) / screenHeight), 0.2, 1);
    preview.style.width = screenWidth + "px";
    preview.style.height = screenHeight + "px";
    preview.style.transform = `scale(${scale})`;
    screenBox.style.width = screenWidth * scale + "px";
    screenBox.style.height = screenHeight * scale + "px";

    const pane = inPreview(".dframe-pane-primary");
    const column = inPreview('[data-cds="ChatComposer"]');
    const sidebar = inPreview(".dframe-sidebar");
    if (!pane || !column || !sidebar) {
        return;
    }
    const paneBox = pane.getBoundingClientRect();
    const columnBox = column.getBoundingClientRect();
    const sidebarBox = sidebar.getBoundingClientRect();

    cover(byId("zone-sidebar"), sidebarBox.left, sidebarBox.top, sidebarBox.width, sidebarBox.height);
    cover(byId("zone-main"), paneBox.left, paneBox.top, paneBox.width, paneBox.height);
    // The empty space on each side of the chat, below the title bar.
    cover(byId("zone-left"), paneBox.left, paneBox.top + 48, columnBox.left - paneBox.left, paneBox.height - 48);
    cover(byId("zone-right"), columnBox.right, paneBox.top + 48, paneBox.right - columnBox.right, paneBox.height - 48);

    for (const side of Object.keys(sideKeys)) {
        const picture = inPreview(`.claude-sticker[data-side="${side}"]`);
        const grip = byId("grip-" + side);
        const shown = part === side && state.enabled && state[sideKeys[side]] !== null &&
            picture !== null && picture.style.display !== "none";

        grip.hidden = !shown;
        if (shown) {
            const box = picture.getBoundingClientRect();
            cover(grip, box.left, box.top, box.width, box.height);
        }
    }
}

// Dragging a side picture on the screen moves it up or down; dragging the corner
// nearest the chat resizes it.
function watchGrip(grip) {
    const side = grip.dataset.side;
    let start = null;

    grip.addEventListener("pointerdown", (event) => {
        const picture = inPreview(`.claude-sticker[data-side="${side}"]`);
        const pane = inPreview(".dframe-pane-primary");
        const column = inPreview('[data-cds="ChatComposer"]');
        if (!picture || !pane || !column) {
            return;
        }
        const box = picture.getBoundingClientRect();
        const paneBox = pane.getBoundingClientRect();
        const columnBox = column.getBoundingClientRect();

        // These match placeStickers in content.js: the picture stays below the
        // 56px title bar and 12px clear of the edges.
        start = {
            x: event.clientX,
            y: event.clientY,
            top: box.top,
            width: box.width,
            resizing: event.target.classList.contains("handle"),
            highest: paneBox.top + 56,
            spare: paneBox.height - 56 - 12 - box.height,
            room: (side === "left" ? columnBox.left - paneBox.left : paneBox.right - columnBox.right) - 24
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
            const towardsChat = side === "left" ? across : -across;
            const grown = start.width < start.room ? towardsChat * 2 : towardsChat;
            save({ stickerSize: clamp(Math.round(start.width + grown), 60, 800) }, "flow");
        } else if (start.spare > 0) {
            const share = (start.top + down - start.highest) / start.spare;
            save({ stickerPosition: clamp(Math.round(share * 100), 0, 100) }, "flow");
        }
    });

    for (const ending of ["pointerup", "pointercancel"]) {
        grip.addEventListener(ending, () => {
            start = null;
        });
    }
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
    for (const side of Object.keys(sideKeys)) {
        byId("zone-" + side).classList.toggle("bare", state[sideKeys[side]] === null);
    }
    byId("panel-main").hidden = part !== "main";
    byId("panel-sidebar").hidden = part !== "sidebar";
    byId("panel-side").hidden = !(part in sideKeys);
    byId("side-title").textContent = part === "left" ? "Picture on the left" : "Picture on the right";

    byId("main-now").textContent = backgroundName(state.preset, state.imageId);
    byId("side-now").textContent = backgroundName(state.sidebarPreset, state.sidebarImageId);

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
            press(button, part in sideKeys ? state[sideKeys[part]] === id : state.stickerLeft === id || state.stickerRight === id);
        } else {
            press(button, usedOn(part === "sidebar" ? "sidebar" : "main", kind, id));
        }
    }
    if (part in sideKeys) {
        for (const button of byId("side-choices").children) {
            press(button, (state[sideKeys[part]] || "") === button.dataset.side);
        }
    }

    const goes = {
        main: "the main page's background",
        sidebar: "the sidebar's picture",
        left: "the picture on the left",
        right: "the picture on the right"
    };
    byId("browse-for").textContent = "The first one becomes " + goes[part] + ".";
    byId("hint").textContent = state.enabled
        ? "Click a part of the screen to change it. Drag a picture onto a part to use it there."
        : "The theme is switched off, so claude.ai looks the way it normally does. Tick Theme on to see it.";

    byId("undo").disabled = steps.length === 0;
    byId("redo").disabled = undoneSteps.length === 0;
}

async function start() {
    state = await chrome.storage.local.get(defaults);

    // Chrome reads this page fresh from the folder each time, but keeps the page
    // script and the manifest it loaded earlier. A different version number means
    // the folder has changed since then.
    byId("stale").hidden = chrome.runtime.getManifest().version === filesVersion;

    // The main page.
    slider("opacity", "opacity", percent, fraction, hundredths);
    colours("text-swatches", "text-color", "textColor", textSwatches, "#ffffff");
    colours("code-swatches", "code-color", "codeColor", codeSwatches, "#8e2626");
    fontChoice("font", "font-custom", "font", "fontCustom");
    oneOf("frameLayout", { separate: "layout-separate", combined: "layout-combined" });
    slider("frame-width", "frameWidth", pixels, same, same);

    // The sidebar.
    oneOf("sidebarMode", { joined: "side-joined", own: "side-own", plain: "side-plain" });
    slider("panel", "panelOpacity", percent, fraction, hundredths);
    slider("side-opacity", "sidebarOpacity", percent, fraction, hundredths);
    colours("side-text-swatches", "side-text-color", "sidebarTextColor", textSwatches, "#ffffff");
    fontChoice("side-font", "side-font-custom", "sidebarFont", "sidebarFontCustom");
    slider("frame-width-side", "frameSidebarWidth", pixels, same, same);

    // The pictures beside the chat.
    slider("sticker-size", "stickerSize", pixels, same, same);
    slider("sticker-position", "stickerPosition", place, same, same);
    slider("sticker-opacity", "stickerOpacity", percent, fraction, hundredths);

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
        } else if ((key === "delete" || key === "backspace") && !typing && part in sideKeys && state[sideKeys[part]] !== null) {
            // Takes the picture off this side. It stays in the library.
            save({ [sideKeys[part]]: null });
        }
    });

    watchDrops();
    watchGrip(byId("grip-left"));
    watchGrip(byId("grip-right"));

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

    // The toolbar icon was clicked while this editor was already open: come to the front.
    chrome.runtime.onMessage.addListener((message, sender, answer) => {
        if (message && message.type === "show-editor") {
            chrome.tabs.getCurrent((tab) => {
                if (tab) {
                    chrome.tabs.update(tab.id, { active: true });
                    chrome.windows.update(tab.windowId, { focused: true });
                }
            });
            answer(true);
        }
    });

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
    showMode(dark);

    window.addEventListener("resize", layout);
    setInterval(layout, 150);

    sync();
    layout();
}

start();
