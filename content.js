// Runs on every claude.ai page. Reads the saved settings, shows the background, the
// sidebar's picture and the pictures beside the chat, draws the frames and sets the
// chat text's colour and font. `defaults`, `presets`, `frameValues`, `fontFamily`,
// `hslParts`, `imageKey`, `stickerKey` and `readSettings` come from settings.js.

const root = document.documentElement;
let settings = defaults;

// True on a page that is left exactly as Claude draws it: anything that is not a
// chat. See onChatPage.
let plainPage = false;

// True when this ought to be a chat, going by its address, but has none of the
// parts a chat is known by: claude.ai has probably been rebuilt since this version
// was written. The page is then left as Claude draws it, and the editor says why.
let unfamiliar = false;

// The address this page had when it was last looked at, and when that began.
let address = location.pathname;
let addressSince = Date.now();
// How long a page is given to finish loading before its address stops counting.
const loadingTime = 6000;
let wallpaper = null;
let frameUrl = null;

// The two picture layers: the main background and the sidebar's own picture.
// Each remembers its image's address and counts its loads. `width` and `height`
// are a saved image's own size, once it has been read; a preset has none.
const layers = {
    main: { url: null, loads: 0, width: 0, height: 0 },
    sidebar: { url: null, loads: 0, width: 0, height: 0 }
};

// The pictures beside the chat. `stickers` holds the <img> of each one that is
// placed, under its key, with the id of the saved picture it shows. `stickerFiles`
// holds each of those saved pictures, under its id, as an address an <img> can
// show: `url` is null until the file has been fetched. Two placed copies of one
// picture share it.
const stickers = new Map();
// The one element that holds them all, once there is a picture to show.
let stickerHolder = null;
const stickerFiles = new Map();

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
    layer.width = 0;
    layer.height = 0;

    // A saved image is laid out from its own size, so it is not shown until that
    // has been read. Otherwise it would appear at one size and jump to another.
    if (url) {
        const probe = new Image();
        await new Promise((done) => {
            probe.addEventListener("load", done);
            probe.addEventListener("error", done);
            probe.src = url;
        });
        if (layer.url !== url) {
            return;
        }
        layer.width = probe.naturalWidth;
        layer.height = probe.naturalHeight;
    }
    show(css);
    sizePictures();
}

// Where and how big to draw a layer's picture, in pixels from the box's corner, or
// null to let it fill its box the ordinary way (a preset, or a picture whose size
// is not known).
//
// The picture's middle is always the middle of `seen`, the part of the box that
// nothing covers, whatever the zoom: zooming makes the picture bigger or smaller
// around that point and never slides it. At a zoom of 0 the whole picture just
// fits inside `seen`. At 1 it is the smallest size that still covers all of
// `box`. Between the two it is in between, and above 1 it is that many times the
// covering size.
function zoomedPicture(layer, zoom, box, seen) {
    if (!layer.width || !layer.height || !box.width || !box.height || !seen.width || !seen.height) {
        return null;
    }
    const middleX = seen.left - box.left + seen.width / 2;
    const middleY = seen.top - box.top + seen.height / 2;
    const fills = Math.max(
        2 * Math.max(middleX, box.width - middleX) / layer.width,
        2 * Math.max(middleY, box.height - middleY) / layer.height
    );
    const whole = Math.min(seen.width / layer.width, seen.height / layer.height);
    const scale = zoom > 1 ? fills * zoom : whole + (fills - whole) * Math.max(0, zoom);
    const width = layer.width * scale;
    const height = layer.height * scale;
    return { width: width, height: height, left: middleX - width / 2, top: middleY - height / 2 };
}

// Set one of the values the stylesheet reads from the top of the page, or take it
// away when `value` is null. Nothing is written when it is already right.
function setRootValue(name, value) {
    if (value === null) {
        if (root.style.getPropertyValue(name)) {
            root.style.removeProperty(name);
        }
    } else if (root.style.getPropertyValue(name) !== value) {
        root.style.setProperty(name, value);
    }
}

// The part of the window in which the main picture can be seen: the chat window,
// or the whole window. Its width and height are the resolution a stretched
// picture is given. The picture lies
// behind the whole window. A sidebar that is joined to it is see-through, so the
// whole window counts; any other sidebar hides the strip it stands on, and what
// is left is the part to its right. (On claude.ai the page area itself runs
// underneath the sidebar, so it is the sidebar that has to be measured.)
function seenBeside(box) {
    const sidebar = settings.sidebarMode === "joined"
        ? null
        : document.querySelector('.dframe-root[data-variant="web"]:not([data-collapsed]) .dframe-sidebar');
    const edge = sidebar ? sidebar.getBoundingClientRect() : null;
    // Only a sidebar standing on the left, with room left beside it.
    if (!edge || edge.width === 0 || edge.left + edge.width / 2 > box.left + box.width / 2 || edge.right >= box.right) {
        return box;
    }
    return { left: edge.right, top: box.top, width: box.right - edge.right, height: box.height };
}

// Lay out both pictures. This is worked out in pixels from the size of the
// window and of the sidebar, so it is done again whenever those change.
function sizePictures() {
    if (wallpaper) {
        const box = wallpaper.getBoundingClientRect();
        const seen = seenBeside(box);
        const automatic = settings.imageZoom === null;
        let drawn = null;
        if (automatic && stretches(layers.main.width, layers.main.height)) {
            // Stretched: exactly as wide and as tall as the space, corner to corner.
            drawn = {
                width: Math.ceil(seen.width),
                height: Math.ceil(seen.height),
                left: Math.floor(seen.left - box.left),
                top: Math.floor(seen.top - box.top)
            };
        } else {
            drawn = zoomedPicture(layers.main, automatic ? 1 : settings.imageZoom, box, seen);
        }

        let size = "";
        let position = "";
        if (drawn) {
            // Then moved by however far it has been dragged.
            size = Math.round(drawn.width) + "px " + Math.round(drawn.height) + "px";
            position = Math.round(drawn.left + settings.imageShiftX * seen.width) + "px " +
                Math.round(drawn.top + settings.imageShiftY * seen.height) + "px";
        }
        if (wallpaper.style.backgroundSize !== size) {
            wallpaper.style.backgroundSize = size;
        }
        if (wallpaper.style.backgroundPosition !== position) {
            wallpaper.style.backgroundPosition = position;
        }
    }

    // The sidebar's own picture: its zoom, and how far it has been dragged from the
    // middle of the sidebar.
    const zoomed = settings.sidebarZoom !== 1;
    const moved = settings.sidebarShiftX !== 0 || settings.sidebarShiftY !== 0;
    const sidebar = settings.sidebarMode === "own" && (zoomed || moved)
        ? document.querySelector(".dframe-sidebar")
        : null;
    const box = sidebar ? sidebar.getBoundingClientRect() : null;
    const drawn = box && zoomed ? zoomedPicture(layers.sidebar, settings.sidebarZoom, box, box) : null;
    setRootValue("--sidebar-image-size", drawn
        ? Math.round(drawn.width) + "px " + Math.round(drawn.height) + "px"
        : null);
    setRootValue("--sidebar-image-position", box && moved
        ? "calc(50% + " + Math.round(settings.sidebarShiftX * box.width) + "px) calc(50% + " +
            Math.round(settings.sidebarShiftY * box.height) + "px)"
        : null);
}

// The main page's theme is for chats. claude.ai's other pages (Projects, Artifacts,
// Scheduled, Customize and the rest) are built from solid panels of their own, which
// a background shows through in patches, so those pages are left as Claude draws
// them. A chat is a page with a message box in it.
//
// While a page is still loading there is nothing to look at yet, and its address
// decides, so that a chat does not flash plain before its theme appears. That
// lasts a few seconds only. A page that still has no message box after that is
// not themed whatever its address says: the theme goes only where the page is
// built the way this version knows, and anywhere else Claude's own page is shown
// whole rather than a half-themed one.
function onChatPage() {
    if (location.pathname !== address) {
        address = location.pathname;
        addressSince = Date.now();
    }
    const pane = ".dframe-pane-primary ";
    const chatAddress = /^\/($|new($|\/)|chat\/)/.test(address);
    unfamiliar = false;

    if (document.querySelector(pane + '[data-cds="Page"]')) {
        return false;
    }
    if (document.querySelector(pane + '[data-cds="ChatComposer"], [data-testid="chat-column-body"]')) {
        return true;
    }
    if (chatAddress && Date.now() - addressSince < loadingTime) {
        return true;
    }
    unfamiliar = chatAddress && document.readyState === "complete";
    return false;
}

// Whether the settings ask for a background on the main page at all.
function wantsBackground() {
    const preset = presets.find((item) => item.id === settings.preset);
    return settings.enabled && settings.preset !== "none" && Boolean(preset || settings.imageId);
}

function applyBackground(sourceChanged) {
    // Off, set to Claude's own background, nothing to show, or not a chat.
    if (!wantsBackground() || plainPage) {
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
    sizePictures();
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
    sizePictures();
}

// Fetch one saved side picture from storage, and show it in every <img> that is
// waiting for it.
async function loadStickerFile(id) {
    const file = { url: null };
    stickerFiles.set(id, file);
    const key = stickerKey(id);
    const saved = await chrome.storage.local.get(key);
    // Every picture that showed it was taken away while it was loading, or it is gone.
    if (stickerFiles.get(id) !== file || !saved[key]) {
        return;
    }
    file.url = URL.createObjectURL(dataUrlToBlob(saved[key]));
    for (const slot of stickers.values()) {
        if (slot.id === id) {
            slot.element.src = file.url;
        }
    }
    placeStickers();
}

// Make the pictures on the page match the list: an <img> for each placed picture,
// and none for one that has been taken away. A picture that is still in the list
// keeps its <img>, whatever else about it has changed. placeStickers does this
// first, every time, so the two cannot fall out of step.
function matchStickers() {
    const placed = new Map(settings.placed.map((item) => [item.key, item]));
    for (const [key, slot] of stickers) {
        if (!placed.has(key) || placed.get(key).id !== slot.id) {
            slot.element.remove();
            stickers.delete(key);
        }
    }
    for (const [id, file] of stickerFiles) {
        if (!settings.placed.some((item) => item.id === id)) {
            if (file.url) {
                URL.revokeObjectURL(file.url);
            }
            stickerFiles.delete(id);
        }
    }

    for (const item of settings.placed) {
        if (!stickerFiles.has(item.id)) {
            loadStickerFile(item.id);
        }
        if (!stickers.has(item.key)) {
            const element = document.createElement("img");
            element.className = "claude-sticker";
            element.alt = "";
            // The editor finds each picture in its preview by its key.
            element.dataset.key = item.key;
            element.dataset.side = item.side;
            // The picture's height is only known once it has loaded.
            element.addEventListener("load", placeStickers);
            const url = stickerFiles.get(item.id).url;
            if (url) {
                element.src = url;
            }
            stickers.set(item.key, { element: element, id: item.id });
        }
    }
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

    matchStickers();
    settings.placed.forEach((item, index) => {
        const element = stickers.get(item.key).element;

        let room = 0;
        if (settings.enabled && stickerFiles.get(item.id).url && home && columnBox && columnBox.width > 0) {
            room = item.side === "left" ? columnBox.left - paneBox.left : paneBox.right - columnBox.right;
            room -= stickerGap * 2;
        }

        if (room < stickerSmallest) {
            element.style.display = "none";
            return;
        }
        if (!stickerHolder) {
            stickerHolder = document.createElement("div");
            stickerHolder.className = "claude-stickers";
        }
        if (stickerHolder.parentNode !== home) {
            home.appendChild(stickerHolder);
        }
        if (element.parentNode !== stickerHolder) {
            stickerHolder.appendChild(element);
        }

        // Keep clear of the bar along the top of the chat window.
        const top = paneBox.top + 56;
        const height = paneBox.height - 56 - stickerGap;

        // As wide as asked for, but never wider than the chat window, and never
        // so wide that the picture's own shape would make it taller than the window.
        let width = Math.min(item.size, paneBox.width - stickerGap * 2);
        if (element.naturalWidth && element.naturalHeight) {
            width = Math.min(width, height * element.naturalWidth / element.naturalHeight);
        }
        width = Math.max(width, 1);

        // Centred in the empty space when it fits, from the window's edge when it does not.
        const spare = Math.max(0, room - width) / 2;
        let start = item.side === "left"
            ? paneBox.left + stickerGap + spare
            : paneBox.right - stickerGap - spare - width;

        // Then moved sideways by however far it has been dragged, but never out of
        // the chat window.
        if (item.shift !== 0) {
            start = Math.min(Math.max(start + item.shift, paneBox.left + stickerGap), paneBox.right - stickerGap - width);
        }

        const share = item.position / 100;
        const style = element.style;
        style.display = "block";
        style.left = start + "px";
        style.width = width + "px";
        style.maxHeight = height + "px";
        // `share` of the way down: 0 touches the top, 1 touches the bottom.
        style.top = top + height * share + "px";
        style.transform = `translateY(${-share * 100}%)`;
        style.opacity = item.opacity;
        // The list runs from the back to the front. The holder is what keeps them
        // all below the page's own contents (see .claude-stickers in theme.css);
        // inside it each has a layer of its own. A layer is changed here and never
        // by moving the <img>, which would start a GIF again.
        style.zIndex = index;
    });
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
            // A stored frame that is not a picture leaves only "Your frame" undrawn.
            try {
                frameUrl = URL.createObjectURL(dataUrlToBlob(settings.frameImage));
            } catch (error) {
                console.warn("Claude Themes: the uploaded frame could not be read.", error);
            }
        }
    }

    const combined = settings.frameLayout === "combined";
    applyFrame("sidebar", combined ? "none" : settings.frameSidebar);
    // The chat window's frame is part of the main page's theme: chats only.
    applyFrame("main", combined || plainPage ? "none" : settings.frameMain);
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
    // The main page's text is themed in chats only.
    const main = on && !plainPage;

    const colour = main ? settings.textColor : null;
    applyTextValue("data-ct-text", "--ct-text", colour);
    if (colour) {
        root.style.setProperty("--ct-text-hsl", hslParts(colour));
    }
    applyTextValue("data-ct-code", "--ct-code", main ? settings.codeColor : null);
    applyTextValue("data-ct-font", "--ct-font", main ? fontFamily(settings.font, settings.fontCustom) : null);

    // A sidebar joined to the main background loses that background on a page that
    // is not a chat, and a colour chosen to be read against it goes with it.
    const bare = plainPage && settings.sidebarMode === "joined" && wantsBackground();
    const sideColour = on && !bare ? settings.sidebarTextColor : null;
    applyTextValue("data-ct-side-text", "--ct-side-text", sideColour);
    if (sideColour) {
        root.style.setProperty("--ct-side-text-hsl", hslParts(sideColour));
    }
    applyTextValue("data-ct-side-font", "--ct-side-font",
        on ? fontFamily(settings.sidebarFont, settings.sidebarFontCustom) : null);
}

// ---------- The editor, laid over the page ----------

// The editor is one of the extension's own pages (editor.html), shown in a
// see-through frame that covers the window. It cannot look into this page, so
// this page tells it where the parts are.
let editorFrame = null;
let editorTimer = null;
const editorOrigin = new URL(chrome.runtime.getURL("editor.html")).origin;

// Where an element is, or null if it is not showing.
function boxOf(element) {
    if (!element || !element.isConnected || element.style.display === "none") {
        return null;
    }
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
}

function tellEditor() {
    if (!editorFrame || !editorFrame.contentWindow) {
        return;
    }
    editorFrame.contentWindow.postMessage({
        claudeThemes: "layout",
        plainPage: plainPage,
        unfamiliar: unfamiliar,
        boxes: {
            // Only an open sidebar: the theme leaves a collapsed one alone.
            sidebar: boxOf(document.querySelector('.dframe-root[data-variant="web"]:not([data-collapsed]) .dframe-sidebar')),
            pane: boxOf(document.querySelector(".dframe-pane-primary")),
            column: boxOf(document.querySelector('[data-cds="ChatComposer"]')),
            // Each picture beside the chat, under its key.
            placed: Object.fromEntries([...stickers].map(([key, slot]) => [key, boxOf(slot.element)]))
        }
    }, editorOrigin);
}

function openEditor() {
    if (editorFrame) {
        return;
    }
    editorFrame = document.createElement("iframe");
    editorFrame.id = "claude-themes-editor";
    editorFrame.title = "Claude Themes editor";
    editorFrame.src = chrome.runtime.getURL("editor.html?on=page");
    root.appendChild(editorFrame);
    // So that its keys (Esc, undo) work without a click first.
    editorFrame.addEventListener("load", () => {
        if (editorFrame) {
            editorFrame.focus();
        }
    });
    editorTimer = setInterval(tellEditor, 150);
    window.addEventListener("resize", tellEditor);
}

function closeEditor() {
    if (!editorFrame) {
        return;
    }
    clearInterval(editorTimer);
    window.removeEventListener("resize", tellEditor);
    editorFrame.remove();
    editorFrame = null;
}

function watchEditor() {
    // The toolbar icon, by way of background.js.
    chrome.runtime.onMessage.addListener((message, sender, answer) => {
        if (message && message.type === "toggle-editor") {
            if (editorFrame) {
                closeEditor();
            } else {
                openEditor();
            }
            answer(true);
        } else if (message && message.type === "open-editor") {
            openEditor();
            answer(true);
        }
    });

    // The editor itself: ready for its measurements, or finished with.
    window.addEventListener("message", (event) => {
        if (!editorFrame || event.source !== editorFrame.contentWindow || !event.data) {
            return;
        }
        if (event.data.claudeThemes === "ready") {
            tellEditor();
        } else if (event.data.claudeThemes === "close") {
            closeEditor();
        }
    });

    // If the toolbar icon opened this tab, it wants the editor shown.
    chrome.runtime.sendMessage({ type: "page-ready" }).then((answer) => {
        if (answer && answer.open) {
            openEditor();
        }
    }).catch(() => {
        // Nobody answered; nothing to do.
    });
}

// Look again at what kind of page this is, and switch the main page's theme on or
// off if that has changed.
function checkPage() {
    const plain = !onChatPage();
    if (plain === plainPage) {
        return;
    }
    plainPage = plain;
    drawEach([() => applyBackground(false), () => applyFrames(false), applyText, placeStickers]);
}

// Draw each part of the theme on its own. One that cannot be drawn (a stored
// picture that is not a picture, say) must not stop the others, or stop the
// listeners in start from being set up.
function drawEach(parts) {
    for (const part of parts) {
        try {
            part();
        } catch (error) {
            console.warn("Claude Themes: a part of the theme could not be drawn.", error);
        }
    }
}

async function start() {
    settings = await readSettings();
    plainPage = !onChatPage();
    drawEach([() => applyBackground(true), () => applySidebar(true), () => applyFrames(true), applyText, placeStickers]);

    chrome.storage.onChanged.addListener((changes) => {
        for (const key of Object.keys(changes)) {
            // Full-size pictures are stored under their own keys; skip those.
            // A setting that was deleted has no new value, so it goes back to its default.
            if (Object.hasOwn(defaults, key)) {
                settings[key] = "newValue" in changes[key] ? changes[key].newValue : defaults[key];
            }
        }
        drawEach([
            () => applyBackground("preset" in changes || "imageId" in changes),
            () => applySidebar("sidebarMode" in changes || "sidebarPreset" in changes || "sidebarImageId" in changes),
            () => applyFrames("frameImage" in changes),
            applyText,
            placeStickers
        ]);
    });

    // If the page removes our element or attributes while it loads, put them back.
    const observer = new MutationObserver(() => {
        drawEach([() => applyBackground(false), () => applySidebar(false), () => applyFrames(false), applyText]);
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

    // claude.ai goes from page to page without reloading. Whenever it adds or takes
    // away part of the page, look at whether this is still a chat: once for each
    // burst of changes, a moment after the first of them. (A timer, because a tab
    // that is not showing draws no frames to wait for.)
    let looking = false;
    new MutationObserver(() => {
        if (!looking) {
            looking = true;
            setTimeout(() => {
                looking = false;
                checkPage();
            }, 30);
        }
    }).observe(root, { childList: true, subtree: true });

    // The empty space beside the chat changes when the window is resized, the
    // sidebar opens or closes, or another chat is opened. claude.ai swaps pages
    // without reloading, so a slow timer catches the changes nothing announces.
    const watcher = new ResizeObserver(() => {
        placeStickers();
        sizePictures();
    });
    let watched = null;
    window.addEventListener("resize", placeStickers);
    window.addEventListener("resize", sizePictures);
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
        drawEach([checkPage, placeStickers, sizePictures]);
    }, 1000);

    // Not inside the editor's own preview, which is one of the extension's pages.
    if (location.origin !== editorOrigin) {
        watchEditor();
    }
}

start();
