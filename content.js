// Runs on every claude.ai page. Reads the saved settings, shows the background, the
// sidebar's picture and the pictures beside the chat, draws the frames and sets the
// chat text's colour and font. `defaults`, `presets`, `frameValues`, `fontFamily`,
// `hslParts`, `imageKey` and `stickerKey` come from settings.js.

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

// The pictures beside the chat, one for each side. `setting` names the setting
// that holds the picture's id; `element` is its <img> once it has been made.
const stickers = {
    left: { setting: "stickerLeft", element: null, url: null, loads: 0 },
    right: { setting: "stickerRight", element: null, url: null, loads: 0 }
};

// Space kept clear around a side picture, and the least room worth using.
const stickerGap = 12;
const stickerSmallest = 48;

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

    // Off, set to Claude's own background, or nothing to show.
    if (!settings.enabled || settings.preset === "none" || (!preset && !settings.imageId)) {
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

// The sidebar's background: joined to the main one (nothing to do here), a
// picture of its own, or plain, which is Claude's own sidebar.
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
    setAttribute("data-sidebar-plain", settings.enabled && settings.sidebarMode === "plain");
}

// Fetch one side's picture from storage and put it in that side's <img>.
async function loadSticker(side) {
    const slot = stickers[side];
    const id = settings[slot.setting];
    const turn = ++slot.loads;
    let url = null;

    if (id) {
        const key = stickerKey(id);
        const saved = await chrome.storage.local.get(key);
        // A newer choice was made while this one was loading.
        if (turn !== slot.loads) {
            return;
        }
        if (saved[key]) {
            url = URL.createObjectURL(dataUrlToBlob(saved[key]));
        }
    }

    if (slot.url) {
        URL.revokeObjectURL(slot.url);
    }
    slot.url = url;

    if (url && !slot.element) {
        slot.element = document.createElement("img");
        slot.element.className = "claude-sticker";
        slot.element.alt = "";
        // The picture's height is only known once it has loaded.
        slot.element.addEventListener("load", placeStickers);
    }
    if (slot.element) {
        if (url) {
            slot.element.src = url;
        } else {
            slot.element.removeAttribute("src");
        }
    }
    placeStickers();
}

// Put each side picture beside the chat: in the empty space between the edge of
// the chat window and the column the messages sit in. The message box is as wide
// as that column, so it is used to find it. A picture that fits is centred in
// that space. A bigger one starts at the window's edge and carries on behind the
// chat: the pictures live inside the page area, above its background and below
// everything written on it (see .claude-sticker in theme.css). With no empty
// space at all they are hidden.
function placeStickers() {
    const pane = document.querySelector(".dframe-pane-primary");
    const column = document.querySelector('[data-cds="ChatComposer"]');
    const paneBox = pane ? pane.getBoundingClientRect() : null;
    const columnBox = column ? column.getBoundingClientRect() : null;
    const home = pane ? pane.closest(".dframe-content") || pane.parentElement : null;

    for (const side of ["left", "right"]) {
        const slot = stickers[side];
        if (!slot.element) {
            continue;
        }

        let room = 0;
        if (settings.enabled && slot.url && home && columnBox && columnBox.width > 0) {
            room = side === "left" ? columnBox.left - paneBox.left : paneBox.right - columnBox.right;
            room -= stickerGap * 2;
        }

        if (room < stickerSmallest) {
            slot.element.style.display = "none";
            continue;
        }
        if (slot.element.parentNode !== home) {
            home.appendChild(slot.element);
        }

        // Keep clear of the bar along the top of the chat window.
        const top = paneBox.top + 56;
        const height = paneBox.height - 56 - stickerGap;

        // As wide as asked for, but never wider than the chat window, and never
        // so wide that the picture's own shape would make it taller than the window.
        let width = Math.min(settings.stickerSize, paneBox.width - stickerGap * 2);
        if (slot.element.naturalWidth && slot.element.naturalHeight) {
            width = Math.min(width, height * slot.element.naturalWidth / slot.element.naturalHeight);
        }
        width = Math.max(width, 1);

        // Centred in the empty space when it fits, from the window's edge when it does not.
        const spare = Math.max(0, room - width) / 2;
        const start = side === "left"
            ? paneBox.left + stickerGap + spare
            : paneBox.right - stickerGap - spare - width;

        const share = settings.stickerPosition / 100;
        const style = slot.element.style;
        style.display = "block";
        style.left = start + "px";
        style.width = width + "px";
        style.maxHeight = height + "px";
        // `share` of the way down: 0 touches the top, 1 touches the bottom.
        style.top = top + height * share + "px";
        style.transform = `translateY(${-share * 100}%)`;
        style.opacity = settings.stickerOpacity;
    }
}

function applyStickers(leftChanged, rightChanged) {
    if (leftChanged) {
        loadSticker("left");
    }
    if (rightChanged) {
        loadSticker("right");
    }
    placeStickers();
}

// One frame goes around the sidebar, the chat window, or the whole window ("all").
// The sidebar's frame has a thickness of its own.
function applyFrame(place, id) {
    const width = place === "sidebar" ? settings.frameSidebarWidth : settings.frameWidth;
    const values = settings.enabled
        ? frameValues(id, width, frameUrl, settings.frameSlice)
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

// Switch one text setting on or off. `name` is the attribute theme.css looks
// for, `variable` the value it reads, and a null value means "leave Claude's own".
function applyTextValue(name, variable, value) {
    if (value) {
        root.style.setProperty(variable, value);
    }
    setAttribute(name, value !== null);
}

// Text, set separately for the chat and for the sidebar. theme.css does the
// restyling; this hands it the colours and the fonts.
function applyText() {
    const on = settings.enabled;

    const colour = on ? settings.textColor : null;
    applyTextValue("data-ct-text", "--ct-text", colour);
    if (colour) {
        root.style.setProperty("--ct-text-hsl", hslParts(colour));
    }
    applyTextValue("data-ct-code", "--ct-code", on ? settings.codeColor : null);
    applyTextValue("data-ct-font", "--ct-font", on ? fontFamily(settings.font, settings.fontCustom) : null);

    const sideColour = on ? settings.sidebarTextColor : null;
    applyTextValue("data-ct-side-text", "--ct-side-text", sideColour);
    if (sideColour) {
        root.style.setProperty("--ct-side-text-hsl", hslParts(sideColour));
    }
    applyTextValue("data-ct-side-font", "--ct-side-font",
        on ? fontFamily(settings.sidebarFont, settings.sidebarFontCustom) : null);
}

async function start() {
    settings = await chrome.storage.local.get(defaults);
    applyBackground(true);
    applySidebar(true);
    applyFrames(true);
    applyText();
    applyStickers(true, true);

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
        applyStickers("stickerLeft" in changes, "stickerRight" in changes);
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
            "data-wallpaper", "data-sidebar-image", "data-sidebar-plain",
            "data-frame-sidebar", "data-frame-main", "data-frame-all",
            "data-ct-text", "data-ct-code", "data-ct-font",
            "data-ct-side-text", "data-ct-side-font"
        ]
    });

    // The empty space beside the chat changes when the window is resized, the
    // sidebar opens or closes, or another chat is opened. claude.ai swaps pages
    // without reloading, so a slow timer catches the changes nothing announces.
    const watcher = new ResizeObserver(placeStickers);
    let watched = null;
    window.addEventListener("resize", placeStickers);
    setInterval(() => {
        const pane = document.querySelector(".dframe-pane-primary");
        if (pane !== watched) {
            if (watched) {
                watcher.unobserve(watched);
            }
            if (pane) {
                watcher.observe(pane);
            }
            watched = pane;
        }
        placeStickers();
    }, 1000);
}

start();
