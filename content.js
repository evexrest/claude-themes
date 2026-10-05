// Runs on every claude.ai page. Reads the saved settings and shows the background.
// `defaults` and `presets` come from settings.js.

const root = document.documentElement;
let settings = defaults;
let wallpaper = null;
let imageUrl = null;

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

function apply(sourceChanged) {
    const preset = presets.find((item) => item.id === settings.preset);

    if (!settings.enabled || (!preset && !settings.image)) {
        if (root.hasAttribute("data-wallpaper")) {
            root.removeAttribute("data-wallpaper");
        }
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
    if (root.getAttribute("data-wallpaper") !== "on") {
        root.setAttribute("data-wallpaper", "on");
    }
}

async function start() {
    settings = await chrome.storage.local.get(defaults);
    apply(true);

    chrome.storage.onChanged.addListener((changes) => {
        for (const key of Object.keys(changes)) {
            settings[key] = changes[key].newValue;
        }
        apply("image" in changes || "preset" in changes);
    });

    // If the page removes our element or attribute while it loads, put them back.
    const observer = new MutationObserver(() => apply(false));
    observer.observe(root, {
        childList: true,
        attributes: true,
        attributeFilter: ["data-wallpaper"]
    });
}

start();
