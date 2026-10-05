// `defaults`, `presets`, `frames`, `frameValues`, `fonts`, `imageKey` and
// `filesVersion` come from settings.js.

const choices = document.getElementById("choices");
const images = document.getElementById("images");
const enabled = document.getElementById("enabled");
const opacity = document.getElementById("opacity");
const panel = document.getElementById("panel");
const frameWidth = document.getElementById("frame-width");
const textColor = document.getElementById("text-color");
const font = document.getElementById("font");
const fontCustom = document.getElementById("font-custom");

// A few text colours that are easy to read on most backgrounds.
const swatches = ["#ffffff", "#f5f0e6", "#cfcfcf", "#ffe9a8", "#0b0b0b", "#2b2b2b", "#10254a", "#3d1010"];

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
    for (const other of ["background", "borders", "text"]) {
        document.getElementById(other).hidden = other !== name;
    }
    select(document.getElementById("tab-" + name));
}

function showLayout(layout) {
    document.getElementById("separate").hidden = layout !== "separate";
    document.getElementById("combined").hidden = layout !== "combined";
    select(document.getElementById("layout-" + layout));
}

// One background button: a preset or a saved image. Only one of them is selected
// at a time, across both grids.
function backgroundChoice(name, background, selected, change) {
    const button = document.createElement("button");
    button.className = "choice";
    button.style.backgroundImage = background;
    button.setAttribute("aria-pressed", selected);

    const label = document.createElement("span");
    label.textContent = name;
    button.appendChild(label);

    button.addEventListener("click", () => {
        for (const other of document.querySelectorAll(".choice")) {
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
    await chrome.storage.local.set(change);
    await chrome.storage.local.remove(imageKey(id));

    cell.remove();
    document.getElementById("images-title").hidden = change.images.length === 0;
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

// One text colour button. A null colour means Claude's own.
function addSwatch(colour, selected) {
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
        save({ textColor: colour });
        if (colour) {
            textColor.value = colour;
        }
    });
    document.getElementById("swatches").appendChild(button);
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
    for (const image of settings.images) {
        addImage(image, !settings.preset && settings.imageId === image.id);
    }

    addFrameRow("frames-sidebar", "frameSidebar", settings);
    addFrameRow("frames-main", "frameMain", settings);
    addFrameRow("frames-all", "frameAll", settings);
    showLayout(settings.frameLayout);

    addSwatch(null, settings.textColor === null);
    for (const colour of swatches) {
        addSwatch(colour, settings.textColor === colour);
    }
    textColor.value = settings.textColor || "#ffffff";

    for (const item of fonts) {
        font.add(new Option(item.name, item.id));
    }
    font.value = settings.font;
    fontCustom.value = settings.fontCustom;
    fontCustom.hidden = settings.font !== "custom";

    enabled.checked = settings.enabled;
    opacity.value = Math.round(settings.opacity * 100);
    panel.value = Math.round(settings.panelOpacity * 100);
    frameWidth.value = settings.frameWidth;
    showPercent(opacity, "opacity-value");
    showPercent(panel, "panel-value");
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

    frameWidth.addEventListener("input", () => {
        document.getElementById("frame-width-value").textContent = frameWidth.value + "px";
        save({ frameWidth: Number(frameWidth.value) });
    });

    // The colour picker: any colour, so none of the ready-made buttons is selected.
    textColor.addEventListener("input", () => {
        for (const swatch of document.querySelectorAll(".swatch")) {
            swatch.setAttribute("aria-pressed", false);
        }
        save({ textColor: textColor.value });
    });

    font.addEventListener("change", () => {
        fontCustom.hidden = font.value !== "custom";
        save({ font: font.value });
    });

    fontCustom.addEventListener("input", () => {
        save({ fontCustom: fontCustom.value });
    });

    for (const name of ["background", "borders", "text"]) {
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

    document.getElementById("choose").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById("choose-frame").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}

start();
