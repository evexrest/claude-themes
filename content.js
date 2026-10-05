// Runs on every claude.ai page. Reads the saved settings, shows the background
// and draws the frames. `defaults`, `presets` and `frameValues` come from settings.js.

const root = document.documentElement;
let settings = defaults;
let wallpaper = null;
let imageUrl = null;
let frameUrl = null;

function dataUrlToBlob(dataUrl) {
    const [head, base64] = dataUrl.split(",");
    const type = head.slice(5, head.indexOf(";"));
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i);
    }
    return new Blob([bytes], { type: type });
}

function setAttribute(name, on) {
    if (on && root.getAttribute(name) !== "on") {
        root.setAttribute(name, "on");
    }
    if (!on && root.hasAttribute(name)) {
        root.removeAttribute(name);
    }
}

function showSource(preset) {
    if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        imageUrl = null;
    }
    if (preset) {
        wallpaper.style.backgroundImage = preset.css;
    } else {
        imageUrl = URL.createObjectURL(dataUrlToBlob(settings.image));
        wallpaper.style.backgroundImage = `url("${imageUrl}")`;
    }
}

function applyBackground(sourceChanged) {
    const preset = presets.find((item) => item.id === settings.preset);

    if (!settings.enabled || (!preset && !settings.image)) {
        setAttribute("data-wallpaper", false);
        return;
    }

    if (!wallpaper) {
        wallpaper = document.createElement("div");
        wallpaper.id = "claude-wallpaper";
        sourceChanged = true;
    }
    if (!wallpaper.isConnected) {
        root.appendChild(wallpaper);
    }
    if (sourceChanged) {
        showSource(preset);
    }
    wallpaper.style.opacity = settings.opacity;
    root.style.setProperty("--panel-opacity", settings.panelOpacity * 100 + "%");
    setAttribute("data-wallpaper", true);
}

// One frame goes around the sidebar, the chat window, or the whole window ("all").
function applyFrame(place, id) {
    const values = settings.enabled
        ? frameValues(id, settings.frameWidth, frameUrl, settings.frameSlice)
        : null;

    if (values) {
        for (const key of Object.keys(values)) {
            root.style.setProperty(`--frame-${place}-${key}`, values[key]);
        }
    }
    setAttribute(`data-frame-${place}`, values !== null);
}

function applyFrames(imageChanged) {
    if (imageChanged) {
        if (frameUrl) {
            URL.revokeObjectURL(frameUrl);
            frameUrl = null;
        }
        if (settings.frameImage) {
            frameUrl = URL.createObjectURL(dataUrlToBlob(settings.frameImage));
        }
    }

    const combined = settings.frameLayout === "combined";
    applyFrame("sidebar", combined ? "none" : settings.frameSidebar);
    applyFrame("main", combined ? "none" : settings.frameMain);
    applyFrame("all", combined ? settings.frameAll : "none");
}

async function start() {
    settings = await chrome.storage.local.get(defaults);
    applyBackground(true);
    applyFrames(true);

    chrome.storage.onChanged.addListener((changes) => {
        for (const key of Object.keys(changes)) {
            settings[key] = changes[key].newValue;
        }
        applyBackground("image" in changes || "preset" in changes);
        applyFrames("frameImage" in changes);
    });

    // If the page removes our element or attributes while it loads, put them back.
    const observer = new MutationObserver(() => {
        applyBackground(false);
        applyFrames(false);
    });
    observer.observe(root, {
        childList: true,
        attributes: true,
        attributeFilter: ["data-wallpaper", "data-frame-sidebar", "data-frame-main", "data-frame-all"]
    });
}

start();
