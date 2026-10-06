// Part of the editor: saving the whole theme to a file, loading one, putting
// everything back to Claude's own, and the note shown the first time the editor is
// opened. Loaded after editor.js, whose `state`, `save`, `say`, `ask`, `byId`,
// `newId`, `openPicture`, `drawn` and `showLibrary` it uses, with `defaults`,
// `imageKey` and `stickerKey` from settings.js.

// A theme file is plain JSON:
//   { claudeThemes: 1, madeWith: "0.18.0", settings: { ... }, pictures: { ... } }
// `settings` holds every setting of the look. `pictures` holds the files that look
// uses, as stored text, under the names the settings call them by: "main",
// "sidebar", "left" and "right". The two lists of saved pictures are not settings
// of the look and are left out.
const themeFormat = 1;
const notInAThemeFile = ["images", "stickers"];
// Where a theme's pictures go: which setting names each one, and which kind it is.
const themePictures = {
    main: { setting: "imageId", kind: "image" },
    sidebar: { setting: "sidebarImageId", kind: "image" },
    left: { setting: "stickerLeft", kind: "sticker" },
    right: { setting: "stickerRight", kind: "sticker" }
};
const largestPicture = 36 * 1024 * 1024;

// The theme as it is now, ready to be written to a file.
async function themeFile() {
    const settings = {};
    for (const key of Object.keys(defaults)) {
        if (!notInAThemeFile.includes(key)) {
            settings[key] = state[key];
        }
    }

    // Only the pictures that are showing: a background that is a preset has none.
    const showing = {
        main: state.preset === null,
        sidebar: state.sidebarMode === "own" && state.sidebarPreset === null,
        left: true,
        right: true
    };
    const pictures = {};
    for (const name of Object.keys(themePictures)) {
        const id = state[themePictures[name].setting];
        if (id && showing[name]) {
            const key = themePictures[name].kind === "image" ? imageKey(id) : stickerKey(id);
            const kept = await chrome.storage.local.get(key);
            if (kept[key]) {
                pictures[name] = kept[key];
            }
        }
    }
    return { claudeThemes: themeFormat, madeWith: filesVersion, settings: settings, pictures: pictures };
}

// One setting from a theme file, checked against the setting's default: the same
// kind of value, or nothing at all where the default is nothing. Anything else,
// and anything this version does not know, is left out, so a file from a stranger
// can only ever set what the editor itself could have set.
function soundSetting(key, value) {
    if (!(key in defaults) || notInAThemeFile.includes(key)) {
        return false;
    }
    if (value === null) {
        return defaults[key] === null || /Id$|^sticker(Left|Right)$|^preset$|Preset$|Color$|^frame(Image|Slice)$/.test(key);
    }
    if (/Color$/.test(key)) {
        return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    }
    if (key === "frameImage") {
        return typeof value === "string" && value.startsWith("data:image/") && value.length < largestPicture;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) && Math.abs(value) <= 10000 && (defaults[key] === null || typeof defaults[key] === "number");
    }
    if (typeof value === "boolean") {
        return typeof defaults[key] === "boolean";
    }
    if (typeof value === "string") {
        return value.length <= 200 && (defaults[key] === null || typeof defaults[key] === "string");
    }
    // The measurements of an uploaded frame are a short list of numbers.
    return key === "frameSlice" && JSON.stringify(value).length < 200;
}

// Take in the text of a theme file: keep its pictures in the library, then switch
// to its settings in one step, which Undo takes back. Returns what to tell the user.
async function loadTheme(text) {
    let file = null;
    try {
        file = JSON.parse(text);
    } catch (error) {
        return "That file is not a theme file.";
    }
    if (!file || file.claudeThemes !== themeFormat || typeof file.settings !== "object" || file.settings === null) {
        return file && file.claudeThemes > themeFormat
            ? "That theme was made with a newer version of Claude Themes. Update the extension to load it."
            : "That file is not a theme file.";
    }

    const change = {};
    for (const key of Object.keys(file.settings)) {
        if (soundSetting(key, file.settings[key])) {
            change[key] = file.settings[key];
        }
    }

    // Each picture is kept under a new id of its own, and the setting that named
    // it is pointed at that. A setting whose picture did not come with the file
    // would point at nothing, so it is emptied.
    const added = { images: [], stickers: [] };
    const files = {};
    for (const name of Object.keys(themePictures)) {
        const place = themePictures[name];
        const data = file.pictures && file.pictures[name];
        if (!(place.setting in change) || change[place.setting] === null) {
            continue;
        }
        change[place.setting] = null;
        if (typeof data !== "string" || !data.startsWith("data:image/") || data.length > largestPicture) {
            continue;
        }
        try {
            const picture = await openPicture(data);
            const id = newId();
            if (place.kind === "image") {
                files[imageKey(id)] = data;
                added.images.push({ id: id, thumb: drawn(picture, 240, "image/jpeg", 0.7), animated: data.startsWith("data:image/gif") });
            } else {
                files[stickerKey(id)] = data;
                added.stickers.push({ id: id, thumb: drawn(picture, 96, "image/png") });
            }
            change[place.setting] = id;
        } catch (error) {
            // Not a picture after all: that part of the theme is left empty.
        }
    }
    // A background with no picture falls back to a preset rather than to nothing.
    if (change.preset === null && !change.imageId) {
        change.preset = defaults.preset;
    }
    if (change.sidebarPreset === null && !change.sidebarImageId) {
        change.sidebarPreset = defaults.sidebarPreset;
    }

    try {
        await chrome.storage.local.set(files);
    } catch (error) {
        return "Could not keep the theme's pictures: " + error.message;
    }
    if (added.images.length > 0) {
        change.images = [...state.images, ...added.images];
    }
    if (added.stickers.length > 0) {
        change.stickers = [...state.stickers, ...added.stickers];
    }
    save(change);
    showLibrary();
    return "Theme loaded. Undo goes back to the one you had.";
}

// Every setting of the look, as it is when the extension is first installed. The
// saved pictures stay in the library.
function freshSettings() {
    const fresh = {};
    for (const key of Object.keys(defaults)) {
        if (!notInAThemeFile.includes(key)) {
            fresh[key] = defaults[key];
        }
    }
    return fresh;
}

byId("theme-save").addEventListener("click", async () => {
    const text = JSON.stringify(await themeFile());
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.download = "claude-theme.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    say("Saved as claude-theme.json in your downloads folder.");
});

byId("theme-load").addEventListener("click", () => {
    byId("theme-file").click();
});

byId("theme-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file) {
        say(await loadTheme(await file.text()));
    }
});

byId("theme-reset").addEventListener("click", async () => {
    if (await ask("Put every setting back to how it was when the extension was installed? Your saved pictures are kept, and Undo takes this back.", "Reset everything")) {
        save(freshSettings());
        say("Everything is back to the start. Undo takes this back.");
    }
});

// The first time the editor is opened, a short note at the top of the library says
// how it works. Once it has been closed it does not come back.
chrome.storage.local.get({ welcomed: false }).then((kept) => {
    byId("welcome").hidden = kept.welcomed === true;
});

byId("welcome-done").addEventListener("click", () => {
    byId("welcome").hidden = true;
    chrome.storage.local.set({ welcomed: true });
});
