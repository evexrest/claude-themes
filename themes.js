// Part of the editor: saving the whole theme to a file, loading one, putting
// everything back to Claude's own, and the note shown the first time the editor is
// opened. Loaded after editor.js, whose `state`, `save`, `say`, `ask`, `byId`,
// `sides`, `openPicture`, `drawn` and `showLibrary` it uses, with `defaults`,
// `imageKey`, `stickerKey`, `newId`, `mostPlaced`, `placedLimits` and
// `placedFromOld` from settings.js.

// A theme file is plain JSON:
//   { claudeThemes: 2, madeWith: "0.20.0", settings: { ... }, pictures: { ... } }
// `settings` holds every setting of the look. `pictures` holds the files that look
// uses, as stored text: the two backgrounds under "main" and "sidebar", and under
// "side" the pictures beside the chat, each under the id the settings call it by.
// The two lists of saved pictures are not settings of the look and are left out.
//
// Format 1 is from before 0.20.0, when each side had one picture. Its settings are
// the old ones (see placedFromOld in settings.js) and its two side pictures are
// under "left" and "right". It still loads.
const themeFormat = 2;
const notInAThemeFile = ["images", "stickers"];
// An uploaded frame is a file of the user's, like a saved picture: going back to a
// fresh look keeps it.
const userFrame = ["frameImage", "frameSlice"];
// The setting that names each of the two backgrounds' pictures.
const themePictures = { main: "imageId", sidebar: "sidebarImageId" };
// The most text one picture in a theme file may be: a background (a 25 MB GIF is
// about this much as text), a picture beside the chat (12 MB), an uploaded frame.
const largestPicture = 36 * 1024 * 1024;
const largestSidePicture = 17 * 1024 * 1024;
const largestFrame = 3 * 1024 * 1024;

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
        sidebar: state.sidebarMode === "own" && state.sidebarPreset === null
    };
    const pictures = {};
    const kept = async (key) => (await chrome.storage.local.get(key))[key];
    for (const name of Object.keys(themePictures)) {
        const id = state[themePictures[name]];
        const data = id && showing[name] ? await kept(imageKey(id)) : null;
        if (data) {
            pictures[name] = data;
        }
    }
    // A picture that is beside the chat more than once is in the file once.
    pictures.side = {};
    for (const id of new Set(state.placed.map((item) => item.id))) {
        const data = await kept(stickerKey(id));
        if (data) {
            pictures.side[id] = data;
        }
    }
    return { claudeThemes: themeFormat, madeWith: filesVersion, settings: settings, pictures: pictures };
}

// A picture as text, in the one form the editor itself writes: an image kind, then
// its bytes in base64. Nothing else can come along inside it, such as a quote that
// would end the `url("...")` a frame's picture is put in.
function soundPicture(data, most) {
    return typeof data === "string" && data.length <= most && /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+\/]+={0,2}$/.test(data);
}

// What a theme file may put in each setting. A setting that takes one of a list
// of names takes only those names; a number keeps to the ends of its slider.
const frameNames = [...frames.map((frame) => frame.id), "none", "custom"];
const settingChoices = {
    preset: [...presets.map((preset) => preset.id), "none"],
    sidebarPreset: presets.map((preset) => preset.id),
    font: fonts.map((font) => font.id),
    sidebarFont: fonts.map((font) => font.id),
    frameMain: frameNames,
    frameSidebar: frameNames,
    frameAll: frameNames,
    frameLayout: ["separate", "combined"],
    sidebarMode: ["joined", "own", "plain"]
};
const settingRanges = {
    opacity: [0, 1], panelOpacity: [0, 1], sidebarOpacity: [0, 1],
    imageZoom: [0, 4], sidebarZoom: [0, 4],
    imageShiftX: [-5, 5], imageShiftY: [-5, 5], sidebarShiftX: [-5, 5], sidebarShiftY: [-5, 5],
    frameWidth: [4, 40], frameSidebarWidth: [4, 40]
};
// Settings that may be empty. An uploaded frame is not among them: a file with no
// frame of its own leaves the user's where it is.
const settingsThatMayBeEmpty = ["preset", "sidebarPreset", "imageId", "sidebarImageId", "imageZoom", "textColor", "codeColor", "sidebarTextColor"];
const settingsThatAreText = ["fontCustom", "sidebarFontCustom", "imageId", "sidebarImageId"];

// One setting from a theme file. Anything this version does not know, and any
// value the editor could not have set, is left out, so a file from a stranger can
// only ever do what the editor itself could have done. The list of placed pictures
// is checked on its own (soundPlaced).
function soundSetting(key, value) {
    if (!Object.hasOwn(defaults, key) || notInAThemeFile.includes(key) || key === "placed") {
        return false;
    }
    if (value === null) {
        return settingsThatMayBeEmpty.includes(key);
    }
    if (Object.hasOwn(settingChoices, key)) {
        return settingChoices[key].includes(value);
    }
    if (Object.hasOwn(settingRanges, key)) {
        return typeof value === "number" && value >= settingRanges[key][0] && value <= settingRanges[key][1];
    }
    if (/Color$/.test(key)) {
        return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    }
    if (key === "frameImage") {
        return soundPicture(value, largestFrame);
    }
    if (key === "frameSlice") {
        // The measurements of an uploaded frame: four numbers.
        return Array.isArray(value) && value.length === 4 && value.every((part) => typeof part === "number" && part >= 0 && part <= 10000);
    }
    if (key === "enabled") {
        return typeof value === "boolean";
    }
    return settingsThatAreText.includes(key) && typeof value === "string" && value.length <= 200;
}

// The pictures beside the chat, from a theme file: no more than there can be, each
// on a side, with every number between the least and the most the editor allows.
// One with anything wrong is left out, and so is anything in one that this version
// does not know. They have no keys yet: loadTheme gives each a new one. Returns
// null when the file has no such list.
function soundPlaced(value) {
    if (!Array.isArray(value)) {
        return null;
    }
    const sound = (item) => item !== null && typeof item === "object" &&
        typeof item.id === "string" && item.id.length <= 200 && sides.includes(item.side) &&
        Object.keys(placedLimits).every((what) => {
            const [least, most] = placedLimits[what];
            return typeof item[what] === "number" && item[what] >= least && item[what] <= most;
        });
    return value.filter(sound).slice(0, mostPlaced).map((item) => ({
        id: item.id, side: item.side, size: item.size, position: item.position, opacity: item.opacity, shift: item.shift
    }));
}

// A format 1 file's settings and pictures, as a format 2 file would hold them: the
// picture each side had becomes one of a list, and its file is named by its side.
function fromFormatOne(file) {
    const settings = { ...file.settings };
    // A file that says nothing about the sides leaves them as they are.
    const placed = placedFromOld(settings);
    if (placed) {
        settings.placed = placed.map((item) => ({ ...item, id: item.side }));
    }
    const pictures = file.pictures || {};
    return { settings: settings, pictures: { main: pictures.main, sidebar: pictures.sidebar, side: { left: pictures.left, right: pictures.right } } };
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
    if (!file || ![1, themeFormat].includes(file.claudeThemes) || typeof file.settings !== "object" || file.settings === null) {
        return file && file.claudeThemes > themeFormat
            ? "That theme was made with a newer version of Claude Themes. Update the extension to load it."
            : "That file is not a theme file.";
    }
    const { settings, pictures } = file.claudeThemes === 1 ? fromFormatOne(file) : { settings: file.settings, pictures: file.pictures || {} };

    const change = {};
    for (const key of Object.keys(settings)) {
        if (soundSetting(key, settings[key])) {
            change[key] = settings[key];
        }
    }

    // A frame is its picture and its measurements together, or neither.
    if (!("frameImage" in change && "frameSlice" in change)) {
        delete change.frameImage;
        delete change.frameSlice;
    }

    // Each picture is kept under a new id of its own. `keep` returns that id, or
    // null for anything that is not a picture.
    const added = { images: [], stickers: [] };
    const files = {};
    const keep = async (data, kind) => {
        if (!soundPicture(data, kind === "image" ? largestPicture : largestSidePicture)) {
            return null;
        }
        try {
            const picture = await openPicture(data);
            const id = newId();
            if (kind === "image") {
                files[imageKey(id)] = data;
                added.images.push({ id: id, thumb: drawn(picture, 240, "image/jpeg", 0.7), animated: data.startsWith("data:image/gif") });
            } else {
                files[stickerKey(id)] = data;
                added.stickers.push({ id: id, thumb: drawn(picture, 96, "image/png") });
            }
            return id;
        } catch (error) {
            return null;
        }
    };

    // The setting that named a background's picture is pointed at its new id. One
    // whose picture did not come with the file would point at nothing, so it is
    // emptied.
    for (const name of Object.keys(themePictures)) {
        const setting = themePictures[name];
        if (setting in change && change[setting] !== null) {
            change[setting] = await keep(pictures[name], "image");
        }
    }
    // A background with no picture falls back to a preset rather than to nothing.
    if (change.preset === null && !change.imageId) {
        change.preset = defaults.preset;
    }
    if (change.sidebarPreset === null && !change.sidebarImageId) {
        change.sidebarPreset = defaults.sidebarPreset;
    }

    // The same for the pictures beside the chat, which may show one picture more
    // than once. One whose picture did not come with the file is left out.
    const placed = soundPlaced(settings.placed);
    if (placed) {
        const side = pictures.side !== null && typeof pictures.side === "object" ? pictures.side : {};
        const ids = new Map();
        for (const item of placed) {
            if (!ids.has(item.id)) {
                ids.set(item.id, await keep(Object.hasOwn(side, item.id) ? side[item.id] : null, "sticker"));
            }
        }
        change.placed = placed.filter((item) => ids.get(item.id)).map((item) => ({ key: newId(), ...item, id: ids.get(item.id) }));
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
        if (!notInAThemeFile.includes(key) && !userFrame.includes(key)) {
            fresh[key] = defaults[key];
        }
    }
    return fresh;
}

// The ready-made themes: a name, and the settings that differ from a fresh
// install. The first five are washes at part strength, which fade into Claude's
// page colour and so follow light and dark mode, with Claude's own text colour.
// The last four are at full strength with a text colour of their own, and look
// the same in both modes. tests/run.mjs checks that each reads well in both.
const builtInThemes = [
    { id: "sunset", name: "Sunset", settings: { preset: "dusk", opacity: 0.55 } },
    { id: "northern-lights", name: "Northern lights", settings: { preset: "aurora", opacity: 0.55, font: "sans", sidebarFont: "sans" } },
    { id: "campfire", name: "Campfire", settings: { preset: "ember", opacity: 0.5, font: "serif" } },
    { id: "deep-sea", name: "Deep sea", settings: { preset: "ocean", opacity: 0.45, font: "rounded", sidebarFont: "rounded" } },
    { id: "woodland", name: "Woodland", settings: { preset: "forest", opacity: 0.5, font: "typewriter" } },
    {
        id: "midnight",
        name: "Midnight",
        settings: { preset: "midnight", opacity: 1, panelOpacity: 0.25, textColor: "#f5f0e6", sidebarTextColor: "#f5f0e6", codeColor: "#8fd3ff" }
    },
    {
        id: "paperback",
        name: "Paperback",
        settings: {
            preset: "paper", opacity: 1, panelOpacity: 0.25, textColor: "#2b2b2b", sidebarTextColor: "#2b2b2b", codeColor: "#8e2626",
            font: "serif", sidebarFont: "serif", frameMain: "double"
        }
    },
    {
        id: "morning-mist",
        name: "Morning mist",
        settings: {
            preset: "mist", opacity: 1, panelOpacity: 0.25, textColor: "#10254a", sidebarTextColor: "#10254a", codeColor: "#8e2626",
            font: "sans", sidebarFont: "sans", frameMain: "fineliner"
        }
    },
    {
        id: "blossom",
        name: "Blossom",
        settings: {
            preset: "blossom", opacity: 1, panelOpacity: 0.25, textColor: "#3d1010", sidebarTextColor: "#3d1010", codeColor: "#0d4a8f",
            font: "rounded", sidebarFont: "rounded"
        }
    }
];

// Everything a ready-made theme sets: a fresh install's settings with its own on
// top. An uploaded frame is a file of the user's, like a saved picture, and stays.
function themeChange(theme) {
    return { ...freshSettings(), ...theme.settings };
}

// The shelf of ready-made themes. Each tile is a small sample: the background,
// and the name in the theme's own text colour and font.
function showThemes() {
    const row = byId("themes");
    for (const theme of builtInThemes) {
        const change = themeChange(theme);
        const button = document.createElement("button");
        button.className = "tile theme";
        button.dataset.theme = theme.id;
        button.title = "Switch to this theme. Your pictures are kept, and Undo takes it back";
        button.style.backgroundImage = presets.find((item) => item.id === change.preset).css;
        const label = document.createElement("span");
        label.textContent = theme.name;
        label.style.color = change.textColor || "";
        label.style.fontFamily = fontFamily(change.font, "") || "";
        button.appendChild(label);
        button.addEventListener("click", () => {
            save(change);
            say(`${theme.name} is on. Undo goes back to the look you had.`);
        });
        row.appendChild(button);
        // Marked while every one of its settings is as the theme left it. (Compared
        // as text, because one of them is a list: no pictures beside the chat.)
        const mark = () => {
            press(button, Object.keys(change).every((key) => JSON.stringify(state[key]) === JSON.stringify(change[key])));
        };
        updaters.push(mark);
        mark();
    }
}
showThemes();

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

// At the foot of the library: which version this is, and the keys that open the
// editor. Chrome leaves the keys unset when another extension already has them.
byId("version").textContent = chrome.runtime.getManifest().version;
async function showShortcut() {
    const opener = (await chrome.commands.getAll()).find((command) => command.name === "_execute_action");
    byId("shortcut").textContent = opener && opener.shortcut
        ? `${opener.shortcut} opens and closes this editor.`
        : "To open this editor from the keyboard, choose the keys at chrome://extensions/shortcuts.";
}
showShortcut();
