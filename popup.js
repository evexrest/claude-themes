// `defaults`, `presets`, `frames`, `frameValues`, `fonts`, `imageKey`, `stickerKey`
// and `filesVersion` come from settings.js.

const choices = document.getElementById("choices");
const images = document.getElementById("images");

// A few text colours that are easy to read on most backgrounds, and a few for the
// words Claude marks out.
const textSwatches = ["#ffffff", "#f5f0e6", "#cfcfcf", "#ffe9a8", "#0b0b0b", "#2b2b2b", "#10254a", "#3d1010"];
const codeSwatches = ["#ffffff", "#ffb3b3", "#ffd479", "#a8e6a1", "#8fd3ff", "#d9b8ff", "#0b0b0b", "#0d4a8f"];

// The popup shows one area (the main page or the sidebar) and one tab at a time.
let area = "main";
let tab = "background";

function save(change) {
    chrome.storage.local.set(change);
}

// Mark one button in a group as the selected one.
function select(button) {
    for (const other of button.parentElement.children) {
        other.setAttribute("aria-pressed", other === button);
    }
}

// Show one area and one of its tabs. The sidebar has no Sides tab.
function show(newArea, newTab) {
    area = newArea;
    tab = area === "side" && newTab === "sides" ? "background" : newTab;

    for (const section of document.querySelectorAll("section")) {
        section.hidden = section.id !== area + "-" + tab;
    }
    document.getElementById("tab-sides").hidden = area === "side";
    select(document.getElementById("area-" + area));
    select(document.getElementById("tab-" + tab));
}

// Tie a slider to a setting. `shown` turns the slider's number into the text
// beside it, and `stored` turns it into the value that is saved.
function slider(id, key, value, shown, stored) {
    const input = document.getElementById(id);
    const label = document.getElementById(id + "-value");
    input.value = value;
    label.textContent = shown(Number(input.value));

    input.addEventListener("input", () => {
        label.textContent = shown(Number(input.value));
        save({ [key]: stored(Number(input.value)) });
    });
}

const percent = (number) => number + "%";
const pixels = (number) => number + "px";
const fraction = (number) => number / 100;
const same = (number) => number;
const place = (number) => number < 20 ? "Top" : number > 80 ? "Bottom" : "Middle";

// The main page's frame goes around the chat window ("separate", which leaves the
// sidebar free to have its own) or around the whole window ("combined").
function showLayout(layout) {
    document.getElementById("separate").hidden = layout !== "separate";
    document.getElementById("combined").hidden = layout !== "combined";
    document.getElementById("side-combined").hidden = layout !== "combined";
    select(document.getElementById("layout-" + layout));
}

function showSidebarMode(mode) {
    for (const other of ["joined", "own", "plain"]) {
        document.getElementById(other).hidden = other !== mode;
    }
    select(document.getElementById("side-" + mode));
}

// One picture button: a preset or a saved image. Only one of them is selected at
// a time within its section.
function backgroundChoice(name, background, selected, change) {
    const button = document.createElement("button");
    button.className = "choice";
    button.style.backgroundImage = background;
    button.setAttribute("aria-pressed", selected);

    const label = document.createElement("span");
    label.textContent = name;
    button.appendChild(label);

    button.addEventListener("click", () => {
        for (const other of button.closest("section").querySelectorAll(".choice")) {
            other.setAttribute("aria-pressed", other === button);
        }
        save(change);
    });
    return button;
}

// A saved image: its button, plus a small cross to remove it.
function addImage(image, selected) {
    const cell = document.createElement("div");
    cell.className = "cell";

    const button = backgroundChoice(image.animated ? "GIF" : "", `url("${image.thumb}")`, selected, { preset: null, imageId: image.id });
    button.title = "Use this image";

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "×";
    remove.title = "Remove this image";
    remove.addEventListener("click", () => {
        removeImage(image.id, cell);
    });

    cell.append(button, remove);
    images.appendChild(cell);
    document.getElementById("images-title").hidden = false;
}

async function removeImage(id, cell) {
    if (!confirm("Remove this image from your saved images?")) {
        return;
    }
    const saved = await chrome.storage.local.get(defaults);
    const change = { images: saved.images.filter((image) => image.id !== id) };

    // If it was the main page's background, go back to the first preset.
    if (!saved.preset && saved.imageId === id) {
        change.preset = defaults.preset;
        change.imageId = null;
        choices.firstElementChild.setAttribute("aria-pressed", true);
    }
    // The same for the sidebar's own picture.
    if (!saved.sidebarPreset && saved.sidebarImageId === id) {
        change.sidebarPreset = defaults.sidebarPreset;
        change.sidebarImageId = null;
    }
    await chrome.storage.local.set(change);
    await chrome.storage.local.remove(imageKey(id));

    cell.remove();
    document.getElementById("images-title").hidden = change.images.length === 0;
    showSidebarChoices({ ...saved, ...change });
}

// The sidebar's own picture: every preset and every saved image.
function showSidebarChoices(settings) {
    const grid = document.getElementById("side-choices");
    grid.replaceChildren();

    for (const preset of presets) {
        grid.appendChild(backgroundChoice(
            preset.name, preset.css, settings.sidebarPreset === preset.id,
            { sidebarPreset: preset.id }
        ));
    }
    for (const image of settings.images) {
        grid.appendChild(backgroundChoice(
            image.animated ? "GIF" : "", `url("${image.thumb}")`, !settings.sidebarPreset && settings.sidebarImageId === image.id,
            { sidebarPreset: null, sidebarImageId: image.id }
        ));
    }
}

// The side pictures. Each side has a row of buttons: "None", then every saved
// picture. `key` is the setting a row changes ("stickerLeft" or "stickerRight").
function showStickerRow(rowId, key, settings) {
    const row = document.getElementById(rowId);
    row.replaceChildren();

    const none = document.createElement("button");
    none.className = "sticker";
    none.textContent = "None";
    none.setAttribute("aria-pressed", settings[key] === null);
    none.addEventListener("click", () => {
        pressSticker(row, none);
        save({ [key]: null });
    });
    row.appendChild(none);

    for (const sticker of settings.stickers) {
        const cell = document.createElement("div");
        cell.className = "cell";

        const button = document.createElement("button");
        button.className = "sticker";
        button.style.backgroundImage = `url("${sticker.thumb}")`;
        button.title = "Use this picture";
        button.setAttribute("aria-pressed", settings[key] === sticker.id);
        button.addEventListener("click", () => {
            pressSticker(row, button);
            save({ [key]: sticker.id });
        });

        const remove = document.createElement("button");
        remove.className = "remove";
        remove.textContent = "×";
        remove.title = "Remove this picture";
        remove.addEventListener("click", () => {
            removeSticker(sticker.id);
        });

        cell.append(button, remove);
        row.appendChild(cell);
    }
}

function pressSticker(row, button) {
    for (const other of row.querySelectorAll(".sticker")) {
        other.setAttribute("aria-pressed", other === button);
    }
}

function showStickers(settings) {
    showStickerRow("stickers-left", "stickerLeft", settings);
    showStickerRow("stickers-right", "stickerRight", settings);
}

async function removeSticker(id) {
    if (!confirm("Remove this picture from your saved pictures?")) {
        return;
    }
    const saved = await chrome.storage.local.get(defaults);
    const change = { stickers: saved.stickers.filter((sticker) => sticker.id !== id) };

    // Take it off whichever side was showing it.
    for (const key of ["stickerLeft", "stickerRight"]) {
        if (saved[key] === id) {
            change[key] = null;
        }
    }
    await chrome.storage.local.set(change);
    await chrome.storage.local.remove(stickerKey(id));
    showStickers({ ...saved, ...change });
}

// One small button showing a frame. `key` is the setting it changes,
// for example "frameSidebar".
function addFrameChoice(row, key, id, name, settings) {
    const button = document.createElement("button");
    button.className = "frame-choice";
    button.title = name;
    button.setAttribute("aria-label", name);
    button.setAttribute("aria-pressed", settings[key] === id);

    const values = frameValues(id, 16, settings.frameImage, settings.frameSlice);
    if (values) {
        const sample = document.createElement("div");
        sample.className = "sample";
        for (const part of Object.keys(values)) {
            sample.style.setProperty("--sample-" + part, values[part]);
        }
        // Samples are small, so every frame is drawn at the same thin width.
        sample.style.setProperty("--sample-width", id === "fineliner" ? "2px" : "9px");
        button.appendChild(sample);
    } else {
        button.textContent = "Off";
    }

    button.addEventListener("click", () => {
        select(button);
        save({ [key]: id });
    });
    row.appendChild(button);
}

function addFrameRow(rowId, key, settings) {
    const row = document.getElementById(rowId);
    addFrameChoice(row, key, "none", "No border", settings);
    for (const frame of frames) {
        addFrameChoice(row, key, frame.id, frame.name, settings);
    }
    if (settings.frameImage) {
        addFrameChoice(row, key, "custom", "Your frame", settings);
    }
}

// One colour button. `key` is the setting it changes, for example "textColor",
// and `picker` is the colour picker next to it. A null colour means Claude's own.
function addSwatch(row, key, picker, colour, selected) {
    const button = document.createElement("button");
    button.className = "swatch";
    button.setAttribute("aria-pressed", selected);

    if (colour) {
        button.style.backgroundColor = colour;
        button.title = colour;
    } else {
        button.textContent = "Auto";
        button.title = "Claude's own colour";
    }

    button.addEventListener("click", () => {
        select(button);
        save({ [key]: colour });
        if (colour) {
            picker.value = colour;
        }
    });
    row.appendChild(button);
}

// A row of colour buttons and its colour picker, for one colour setting.
function addColours(rowId, pickerId, key, colours, current, fallback) {
    const row = document.getElementById(rowId);
    const picker = document.getElementById(pickerId);

    addSwatch(row, key, picker, null, current === null);
    for (const colour of colours) {
        addSwatch(row, key, picker, colour, current === colour);
    }
    picker.value = current || fallback;

    // The picker gives any colour, so none of the ready-made buttons is selected.
    picker.addEventListener("input", () => {
        for (const swatch of row.children) {
            swatch.setAttribute("aria-pressed", false);
        }
        save({ [key]: picker.value });
    });
}

// A font list and the box for typing another font's name, for one font setting.
function addFonts(listId, boxId, fontKey, nameKey, settings) {
    const list = document.getElementById(listId);
    const box = document.getElementById(boxId);

    for (const item of fonts) {
        list.add(new Option(item.name, item.id));
    }
    list.value = settings[fontKey];
    box.value = settings[nameKey];
    box.hidden = list.value !== "custom";

    list.addEventListener("change", () => {
        box.hidden = list.value !== "custom";
        save({ [fontKey]: list.value });
    });
    box.addEventListener("input", () => {
        save({ [nameKey]: box.value });
    });
}

// Open the upload page in a new tab, at one of its parts.
function openUploads(part) {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html" + part) });
}

async function start() {
    const settings = await chrome.storage.local.get(defaults);
    const enabled = document.getElementById("enabled");

    // Chrome reads this popup fresh from the folder each time, but keeps the page
    // script and the manifest it loaded earlier. A different version number means
    // the folder has changed since then.
    document.getElementById("stale").hidden = chrome.runtime.getManifest().version === filesVersion;

    // The main page's background.
    for (const preset of presets) {
        choices.appendChild(
            backgroundChoice(preset.name, preset.css, settings.preset === preset.id, { preset: preset.id })
        );
    }
    // No background at all: Claude looks the way it normally does.
    const plain = backgroundChoice("Claude's own", "none", settings.preset === "none", { preset: "none" });
    plain.classList.add("plain");
    choices.appendChild(plain);

    for (const image of settings.images) {
        addImage(image, !settings.preset && settings.imageId === image.id);
    }
    slider("opacity", "opacity", Math.round(settings.opacity * 100), percent, fraction);

    // The main page's text.
    addColours("text-swatches", "text-color", "textColor", textSwatches, settings.textColor, "#ffffff");
    addColours("code-swatches", "code-color", "codeColor", codeSwatches, settings.codeColor, "#8e2626");
    addFonts("font", "font-custom", "font", "fontCustom", settings);

    // The main page's border.
    addFrameRow("frames-main", "frameMain", settings);
    addFrameRow("frames-all", "frameAll", settings);
    showLayout(settings.frameLayout);
    slider("frame-width", "frameWidth", settings.frameWidth, pixels, same);

    // The pictures beside the chat.
    showStickers(settings);
    slider("sticker-size", "stickerSize", settings.stickerSize, pixels, same);
    slider("sticker-position", "stickerPosition", settings.stickerPosition, place, same);
    slider("sticker-opacity", "stickerOpacity", Math.round(settings.stickerOpacity * 100), percent, fraction);

    // The sidebar's background.
    showSidebarChoices(settings);
    showSidebarMode(settings.sidebarMode);
    slider("panel", "panelOpacity", Math.round(settings.panelOpacity * 100), percent, fraction);
    slider("side-opacity", "sidebarOpacity", Math.round(settings.sidebarOpacity * 100), percent, fraction);

    // The sidebar's text.
    addColours("side-text-swatches", "side-text-color", "sidebarTextColor", textSwatches, settings.sidebarTextColor, "#ffffff");
    addFonts("side-font", "side-font-custom", "sidebarFont", "sidebarFontCustom", settings);

    // The sidebar's border.
    addFrameRow("frames-sidebar", "frameSidebar", settings);
    slider("frame-width-side", "frameSidebarWidth", settings.frameSidebarWidth, pixels, same);

    enabled.checked = settings.enabled;
    enabled.addEventListener("change", () => {
        save({ enabled: enabled.checked });
    });

    for (const name of ["main", "side"]) {
        document.getElementById("area-" + name).addEventListener("click", () => {
            show(name, tab);
        });
    }

    for (const name of ["background", "text", "borders", "sides"]) {
        document.getElementById("tab-" + name).addEventListener("click", () => {
            show(area, name);
        });
    }

    for (const layout of ["separate", "combined"]) {
        document.getElementById("layout-" + layout).addEventListener("click", () => {
            showLayout(layout);
            save({ frameLayout: layout });
        });
    }

    for (const mode of ["joined", "own", "plain"]) {
        document.getElementById("side-" + mode).addEventListener("click", () => {
            showSidebarMode(mode);
            save({ sidebarMode: mode });
        });
    }

    document.getElementById("choose").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    // The upload page, with its crop box already in the sidebar's tall shape.
    document.getElementById("choose-side").addEventListener("click", () => {
        openUploads("#sidebar");
    });

    document.getElementById("choose-sticker").addEventListener("click", () => {
        openUploads("#sides");
    });

    for (const id of ["choose-frame", "choose-frame-side"]) {
        document.getElementById(id).addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
    }

    show("main", "background");
}

start();
