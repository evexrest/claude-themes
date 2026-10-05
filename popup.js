// `defaults`, `presets`, `frames` and `frameValues` come from settings.js.

const choices = document.getElementById("choices");
const enabled = document.getElementById("enabled");
const opacity = document.getElementById("opacity");
const panel = document.getElementById("panel");
const frameWidth = document.getElementById("frame-width");

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
    document.getElementById("background").hidden = name !== "background";
    document.getElementById("borders").hidden = name !== "borders";
    select(document.getElementById("tab-" + name));
}

function showLayout(layout) {
    document.getElementById("separate").hidden = layout !== "separate";
    document.getElementById("combined").hidden = layout !== "combined";
    select(document.getElementById("layout-" + layout));
}

function addChoice(name, background, selected, change) {
    const button = document.createElement("button");
    button.className = "choice";
    button.style.backgroundImage = background;
    button.setAttribute("aria-pressed", selected);

    const label = document.createElement("span");
    label.textContent = name;
    button.appendChild(label);

    button.addEventListener("click", () => {
        select(button);
        save(change);
    });
    choices.appendChild(button);
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

async function start() {
    const settings = await chrome.storage.local.get(defaults);

    // Chrome reads this popup fresh from the folder each time, but keeps the page
    // script and the manifest it loaded earlier. A different version number means
    // the folder has changed since then.
    document.getElementById("stale").hidden = chrome.runtime.getManifest().version === filesVersion;

    for (const preset of presets) {
        addChoice(preset.name, preset.css, settings.preset === preset.id, { preset: preset.id });
    }
    if (settings.image) {
        addChoice("Your image", `url("${settings.image}")`, !settings.preset, { preset: null });
    }

    addFrameRow("frames-sidebar", "frameSidebar", settings);
    addFrameRow("frames-main", "frameMain", settings);
    addFrameRow("frames-all", "frameAll", settings);
    showLayout(settings.frameLayout);

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

    for (const name of ["background", "borders"]) {
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
