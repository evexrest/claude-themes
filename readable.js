// Part of the editor: whether the text can be read against the background behind
// it, in Claude's light mode and its dark mode. Loaded after editor.js, whose
// `state`, `save`, `byId`, `openPicture` and `updaters` it uses, with `presets`
// from settings.js.

// Claude's own colours in each mode, read from claude.ai on 2026-10-05. A
// background at less than full opacity fades into the page colour, and text left
// on "Auto" is Claude's own.
const claudeColours = {
    light: { page: "#fcfcfb", sidebar: "#fafaf9", text: "#0b0b0b" },
    dark: { page: "#262624", sidebar: "#1f1e1d", text: "#faf9f5" }
};
// Below this contrast, text is hard to read (the usual threshold for large text).
const leastContrast = 3;

// "#336699" as [51, 102, 153].
function rgb(hex) {
    return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
}

// One colour laid over another at a share of full strength, from 0 to 1.
function mix(top, under, share) {
    return top.map((value, index) => Math.round(value * share + under[index] * (1 - share)));
}

// How strongly two colours stand apart, from 1 (the same) to 21 (black on white).
function contrast(one, other) {
    const light = (colour) => {
        const [red, green, blue] = colour.map((value) => {
            const part = value / 255;
            return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const [more, less] = [light(one), light(other)].sort((a, b) => b - a);
    return Math.round((more + 0.05) / (less + 0.05) * 100) / 100;
}

// The colours along a preset's wash: each colour it names, and the ones halfway
// between neighbours. Its soft highlight in one corner is left out.
function gradientColours(css) {
    const wash = css.slice(css.lastIndexOf("linear-gradient("));
    const named = [...wash.matchAll(/#[0-9a-f]{6}/gi)].map(([hex]) => rgb(hex));
    return named.flatMap((colour, index) => index === 0 ? [colour] : [mix(named[index - 1], colour, 0.5), colour]);
}

// The colours of a saved picture, read from its small copy at 64 places.
const pictureColourCache = new Map();
async function pictureColours(id, thumb) {
    if (!pictureColourCache.has(id)) {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const pen = canvas.getContext("2d", { willReadFrequently: true });
        pen.drawImage(await openPicture(thumb), 0, 0, 8, 8);
        const dots = pen.getImageData(0, 0, 8, 8).data;
        const colours = [];
        for (let at = 0; at < dots.length; at += 4) {
            colours.push([dots[at], dots[at + 1], dots[at + 2]]);
        }
        pictureColourCache.set(id, colours);
    }
    return pictureColourCache.get(id);
}

// The colours of a background before any fading: a preset's, a saved picture's,
// or null when there is no picture at all.
async function sourceColours(presetId, imageId, images) {
    const preset = presets.find((item) => item.id === presetId);
    if (preset) {
        return gradientColours(preset.css);
    }
    const image = presetId === null && images.find((item) => item.id === imageId);
    return image ? pictureColours(image.id, image.thumb) : null;
}

// The colours the text of one place ("main" or "sidebar") lies on, in one mode.
// `main` and `side` are the two backgrounds' own colours, from sourceColours.
function backdrop(settings, place, mode, main, side) {
    const claude = claudeColours[mode];
    const page = rgb(claude.page);
    const behindChat = main ? main.map((colour) => mix(colour, page, settings.opacity)) : [page];
    if (place === "main") {
        return behindChat;
    }
    const sidebar = rgb(claude.sidebar);
    if (settings.sidebarMode === "own" && side) {
        return side.map((colour) => mix(colour, sidebar, settings.sidebarOpacity));
    }
    if (settings.sidebarMode === "joined" && main) {
        return behindChat.map((colour) => mix(sidebar, colour, settings.panelOpacity));
    }
    return [sidebar];
}

// How well a text colour reads on a backdrop: the contrast it has, or better, on
// three quarters of it. A null colour is Claude's own for that mode.
function reads(textColour, mode, colours) {
    const text = rgb(textColour || claudeColours[mode].text);
    const each = colours.map((colour) => contrast(text, colour)).sort((a, b) => a - b);
    return each[Math.floor((each.length - 1) / 4)];
}

// What to say about one place's text, and a colour that would fix it:
// { modes: ["light", "dark"] that are hard to read, fix: a colour, null for Auto,
// or undefined when no one colour reads well in both modes }.
function readability(settings, place, main, side) {
    const key = place === "main" ? "textColor" : "sidebarTextColor";
    const hardIn = (colour) => ["light", "dark"].filter((mode) =>
        reads(colour, mode, backdrop(settings, place, mode, main, side)) < leastContrast);
    const modes = settings.enabled ? hardIn(settings[key]) : [];
    const fix = modes.length > 0 ? [null, "#ffffff", "#0b0b0b"].find((colour) => hardIn(colour).length === 0) : undefined;
    return { modes: modes, fix: fix };
}

// The warning under a place's text colours, with a button when one click fixes it.
function watchReadability(place, noteId) {
    const key = place === "main" ? "textColor" : "sidebarTextColor";
    const note = byId(noteId);
    const button = note.querySelector("button");
    const names = new Map([[null, "Use Claude's own colour"], ["#ffffff", "Use white"], ["#0b0b0b", "Use black"]]);
    let fix;
    let turn = 0;

    button.addEventListener("click", () => {
        save({ [key]: fix });
    });
    const show = async () => {
        const mine = ++turn;
        const main = state.enabled && state.preset !== "none" ? await sourceColours(state.preset, state.imageId, state.images) : null;
        const side = await sourceColours(state.sidebarPreset, state.sidebarImageId, state.images);
        if (mine !== turn) {
            return;
        }
        const found = readability(state, place, main, side);
        fix = found.fix;
        note.hidden = found.modes.length === 0;
        const where = found.modes.length === 2 ? "both light and dark mode" : `Claude's ${found.modes[0]} mode`;
        note.querySelector("span").textContent =
            `${state[key] ? "This text colour" : "Claude's own text colour"} may be hard to read on this background in ${where}.` +
            (fix === undefined ? " A background at full opacity looks the same in both modes, which makes a colour easier to choose." : "");
        button.hidden = fix === undefined;
        button.textContent = names.get(fix) || "";
    };
    // The editor may or may not have read the settings by the time this file runs.
    updaters.push(show);
    show();
}

watchReadability("main", "text-warning");
watchReadability("sidebar", "side-text-warning");
