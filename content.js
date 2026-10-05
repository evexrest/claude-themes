// Runs on every claude.ai page. Reads the saved settings, shows the background and
// the sidebar's picture, draws the frames and sets the chat text's colour and font. `defaults`, `presets`,
// `frameValues`, `fontFamily`, `hslParts` and `imageKey` come from settings.js.

const root = document.documentElement;
let settings = defaults;
let wallpaper = null;
let frameUrl = null;

// The two picture layers: the main background and the sidebar's own picture.
// Each remembers its image's address and counts its loads.
const layers = {
    main: { url: null, loads: 0 },
    sidebar: { url: null, loads: 0 }
};

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

// Find the CSS for a picture, then hand it to `show`. The picture is a preset's
// gradient, or one of the saved images, which has to be fetched from storage first.
async function loadPicture(layer, presetId, imageId, show) {
    const turn = ++layer.loads;
    const preset = presets.find((item) => item.id === presetId);
    let css = preset ? preset.css : null;
    let url = null;

    if (!preset) {
        const key = imageKey(imageId);
        const saved = await chrome.storage.local.get(key);
        // A newer choice was made while this one was loading, or the image is gone.
        if (turn !== layer.loads || !saved[key]) {
            return;
        }
        url = URL.createObjectURL(dataUrlToBlob(saved[key]));
        css = `url("${url}")`;
    }

    if (layer.url) {
        URL.revokeObjectURL(layer.url);
    }
    layer.url = url;
    show(css);
}

function applyBackground(sourceChanged) {
    const preset = presets.find((item) => item.id === settings.preset);

    if (!settings.enabled || (!preset && !settings.imageId)) {
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
        loadPicture(layers.main, settings.preset, settings.imageId, (css) => {
            wallpaper.style.backgroundImage = css;
        });
    }
    wallpaper.style.opacity = settings.opacity;
    root.style.setProperty("--panel-opacity", settings.panelOpacity * 100 + "%");
    setAttribute("data-wallpaper", true);
}

// The sidebar's own picture, when it is not joined to the main background.
function applySidebar(sourceChanged) {
    const own = settings.enabled && settings.sidebarMode === "own";

    if (own && sourceChanged) {
        loadPicture(layers.sidebar, settings.sidebarPreset, settings.sidebarImageId, (css) => {
            root.style.setProperty("--sidebar-image", css);
        });
    }
    if (own) {
        root.style.setProperty("--sidebar-image-opacity", settings.sidebarOpacity);
    }
    setAttribute("data-sidebar-image", own);
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

// Chat text. theme.css does the restyling; this hands it the colour and the font.
function applyText() {
    const colour = settings.enabled ? settings.textColor : null;
    if (colour) {
        root.style.setProperty("--ct-text", colour);
        root.style.setProperty("--ct-text-hsl", hslParts(colour));
    }
    setAttribute("data-ct-text", colour !== null);

    const code = settings.enabled ? settings.codeColor : null;
    if (code) {
        root.style.setProperty("--ct-code", code);
    }
    setAttribute("data-ct-code", code !== null);

    const font = settings.enabled ? fontFamily(settings.font, settings.fontCustom) : null;
    if (font) {
        root.style.setProperty("--ct-font", font);
    }
    setAttribute("data-ct-font", font !== null);
}

async function start() {
    settings = await chrome.storage.local.get(defaults);
    applyBackground(true);
    applySidebar(true);
    applyFrames(true);
    applyText();

    chrome.storage.onChanged.addListener((changes) => {
        for (const key of Object.keys(changes)) {
            // Full-size pictures are stored under their own keys; skip those.
            // A setting that was deleted has no new value, so it goes back to its default.
            if (key in defaults) {
                settings[key] = "newValue" in changes[key] ? changes[key].newValue : defaults[key];
            }
        }
        applyBackground("preset" in changes || "imageId" in changes);
        applySidebar("sidebarMode" in changes || "sidebarPreset" in changes || "sidebarImageId" in changes);
        applyFrames("frameImage" in changes);
        applyText();
    });

    // If the page removes our element or attributes while it loads, put them back.
    const observer = new MutationObserver(() => {
        applyBackground(false);
        applySidebar(false);
        applyFrames(false);
        applyText();
    });
    observer.observe(root, {
        childList: true,
        attributes: true,
        attributeFilter: [
            "data-wallpaper", "data-sidebar-image",
            "data-frame-sidebar", "data-frame-main", "data-frame-all",
            "data-ct-text", "data-ct-code", "data-ct-font"
        ]
    });
}

start();
