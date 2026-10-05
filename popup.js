// `defaults`, `presets`, `frames`, `frameValues`, `fonts`, `imageKey`, `stickerKey`
// and `filesVersion` come from settings.js.

const choices = document.getElementById("choices");
const images = document.getElementById("images");
const enabled = document.getElementById("enabled");
const opacity = document.getElementById("opacity");
const panel = document.getElementById("panel");
const sideOpacity = document.getElementById("side-opacity");
const stickerSize = document.getElementById("sticker-size");
const stickerPosition = document.getElementById("sticker-position");
const stickerOpacity = document.getElementById("sticker-opacity");
const frameWidth = document.getElementById("frame-width");
const textColor = document.getElementById("text-color");
const codeColor = document.getElementById("code-color");
const font = document.getElementById("font");
const fontCustom = document.getElementById("font-custom");

// A few text colours that are easy to read on most backgrounds, and a few for the
// words Claude marks out.
const textSwatches = ["#ffffff", "#f5f0e6", "#cfcfcf", "#ffe9a8", "#0b0b0b", "#2b2b2b", "#10254a", "#3d1010"];
const codeSwatches = ["#ffffff", "#ffb3b3", "#ffd479", "#a8e6a1", "#8fd3ff", "#d9b8ff", "#0b0b0b", "#0d4a8f"];

const tabs = ["background", "sidebar", "sides", "borders", "text"];

function save(change) {
    chrome.storage.local.set(change);
}

// Mark one button in a group as the selected one.
function select(button) {
    for (const other of button.parentElement.children) {
        other.setAttribute("aria-pressed", other === button);
    }
}

function showPercent(slider, id) {
    document.getElementById(id).textContent = slider.value + "%";
}

function showTab(name) {
    for (const other of tabs) {
        document.getElementById(other).hidden = other !== name;
    }
    select(document.getElementById("tab-" + name));
}

function showLayout(layout) {
    document.getElementById("separate").hidden = layout !== "separate";
    document.getElementById("combined").hidden = layout !== "combined";
    select(document.getElementById("layout-" + layout));
}

// The numbers beside the size and height sliders of the side pictures.
function showStickerNumbers() {
    document.getElementById("sticker-size-value").textContent = stickerSize.value + "px";
    const place = Number(stickerPosition.value);
    document.getElementById("sticker-position-value").textContent =
        place < 20 ? "Top" : place > 80 ? "Bottom" : "Middle";
}

function showSidebarMode(mode) {
    document.getElementById("joined").hidden = mode !== "joined";
    document.getElementById("own").hidden = mode !== "own";
    select(document.getElementById("side-" + mode));
}

// One picture button: a preset or a saved image. Only one of them is selected at
// a time within its tab.
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

    const button = backgroundChoice("", `url("${image.thumb}")`, selected, { preset: null, imageId: image.id });
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

    // If it was the background, go back to the first preset.
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
    showSidebarChoices({ ...saved, ...change });
    document.getElementById("images-title").hidden = change.images.length === 0;
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
            "", `url("${image.thumb}")`, !settings.sidebarPreset && settings.sidebarImageId === image.id,
            { sidebarPreset: null, sidebarImageId: image.id }
        ));
    }
}

// One colour button. `key` is the setting it changes ("textColor" or "codeColor")
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
function addColours(rowId, key, picker, colours, current, fallback) {
    const row = document.getElementById(rowId);
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

async function start() {
    const settings = await chrome.storage.local.get(defaults);

    // Chrome reads this popup fresh from the folder each time, but keeps the page
    // script and the manifest it loaded earlier. A different version number means
    // the folder has changed since then.
    document.getElementById("stale").hidden = chrome.runtime.getManifest().version === filesVersion;

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

    addFrameRow("frames-sidebar", "frameSidebar", settings);
    addFrameRow("frames-main", "frameMain", settings);
    addFrameRow("frames-all", "frameAll", settings);
    showLayout(settings.frameLayout);

    showSidebarChoices(settings);
    showSidebarMode(settings.sidebarMode);
    showStickers(settings);

    addColours("text-swatches", "textColor", textColor, textSwatches, settings.textColor, "#ffffff");
    addColours("code-swatches", "codeColor", codeColor, codeSwatches, settings.codeColor, "#8e2626");

    for (const item of fonts) {
        font.add(new Option(item.name, item.id));
    }
    font.value = settings.font;
    fontCustom.value = settings.fontCustom;
    fontCustom.hidden = settings.font !== "custom";

    enabled.checked = settings.enabled;
    opacity.value = Math.round(settings.opacity * 100);
    panel.value = Math.round(settings.panelOpacity * 100);
    sideOpacity.value = Math.round(settings.sidebarOpacity * 100);
    stickerSize.value = settings.stickerSize;
    stickerPosition.value = settings.stickerPosition;
    stickerOpacity.value = Math.round(settings.stickerOpacity * 100);
    frameWidth.value = settings.frameWidth;
    showPercent(opacity, "opacity-value");
    showPercent(panel, "panel-value");
    showPercent(sideOpacity, "side-opacity-value");
    showPercent(stickerOpacity, "sticker-opacity-value");
    showStickerNumbers();
    document.getElementById("frame-width-value").textContent = frameWidth.value + "px";

    enabled.addEventListener("change", () => {
        save({ enabled: enabled.checked });
    });

    opacity.addEventListener("input", () => {
        showPercent(opacity, "opacity-value");
        save({ opacity: opacity.value / 100 });
    });

    panel.addEventListener("input", () => {
        showPercent(panel, "panel-value");
        save({ panelOpacity: panel.value / 100 });
    });

    sideOpacity.addEventListener("input", () => {
        showPercent(sideOpacity, "side-opacity-value");
        save({ sidebarOpacity: sideOpacity.value / 100 });
    });

    stickerSize.addEventListener("input", () => {
        showStickerNumbers();
        save({ stickerSize: Number(stickerSize.value) });
    });

    stickerPosition.addEventListener("input", () => {
        showStickerNumbers();
        save({ stickerPosition: Number(stickerPosition.value) });
    });

    stickerOpacity.addEventListener("input", () => {
        showPercent(stickerOpacity, "sticker-opacity-value");
        save({ stickerOpacity: stickerOpacity.value / 100 });
    });

    frameWidth.addEventListener("input", () => {
        document.getElementById("frame-width-value").textContent = frameWidth.value + "px";
        save({ frameWidth: Number(frameWidth.value) });
    });

    font.addEventListener("change", () => {
        fontCustom.hidden = font.value !== "custom";
        save({ font: font.value });
    });

    fontCustom.addEventListener("input", () => {
        save({ fontCustom: fontCustom.value });
    });

    for (const name of tabs) {
        document.getElementById("tab-" + name).addEventListener("click", () => {
            showTab(name);
        });
    }

    for (const layout of ["separate", "combined"]) {
        document.getElementById("layout-" + layout).addEventListener("click", () => {
            showLayout(layout);
            save({ frameLayout: layout });
        });
    }

    for (const mode of ["joined", "own"]) {
        document.getElementById("side-" + mode).addEventListener("click", () => {
            showSidebarMode(mode);
            save({ sidebarMode: mode });
        });
    }

    document.getElementById("choose").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById("choose-sticker").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html#sides") });
    });

    // The upload page, with its crop box already in the sidebar's tall shape.
    document.getElementById("choose-side").addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("options.html#sidebar") });
    });

    document.getElementById("choose-frame").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}

start();
