// Shared by content.js, editor.js and options.js.

// Keep this the same as "version" in manifest.json. The editor compares the two to
// tell whether Chrome is still running an older copy of the extension.
const filesVersion = "0.19.0";

const defaults = {
    enabled: true,
    // The background is a preset, one of the saved images when `preset` is null,
    // or Claude's own background when `preset` is "none".
    preset: "dusk",
    imageId: null,
    // The saved images, as a list of { id, thumb, animated }. `thumb` is a small still
    // copy for the editor and `animated` is true for a GIF. Each full-size picture is
    // stored separately, under imageKey(id).
    images: [],
    opacity: 0.5,
    // How a saved image is laid out on the main page. Null is automatic: a picture
    // that is wider than it is tall is stretched to the exact size of the space it
    // is in (the chat window, or the whole window when the sidebar is joined to
    // it), and any other fills the page (see `stretches`). A number sets a zoom by
    // hand and keeps the picture's own proportions: 0 shows the whole picture, 1
    // fills the page with it, cutting off what does not fit, and above 1 it is that
    // many times bigger. The presets are plain colour washes and are not affected.
    imageZoom: null,
    // How far the main picture has been dragged from where its layout puts it, as a
    // share of the width and of the height of its space. 0 is not at all.
    imageShiftX: 0,
    imageShiftY: 0,
    panelOpacity: 0.6,
    // The sidebar is "joined" to the main background, has a picture of its "own"
    // (a preset, or one of the saved images when `sidebarPreset` is null), or is
    // "plain": Claude's own sidebar, with nothing behind it.
    sidebarMode: "joined",
    sidebarPreset: "graphite",
    sidebarImageId: null,
    sidebarOpacity: 0.8,
    // The same for the sidebar's own picture, which fills the sidebar unless it is set.
    sidebarZoom: 1,
    // How far the sidebar's own picture has been dragged, as a share of the sidebar's
    // width and height.
    sidebarShiftX: 0,
    sidebarShiftY: 0,
    frameLayout: "separate",
    frameSidebar: "none",
    frameMain: "none",
    frameAll: "none",
    // Thickness: `frameWidth` for the chat window or the whole window,
    // `frameSidebarWidth` for the sidebar.
    frameWidth: 14,
    frameSidebarWidth: 14,
    frameImage: null,
    frameSlice: null,
    // Pictures in the empty space beside the chat. `stickers` is the list of saved
    // ones, as { id, thumb }; each file is stored separately, under stickerKey(id).
    // `stickerLeft` and `stickerRight` hold the id shown on each side, or null.
    stickers: [],
    stickerLeft: null,
    stickerRight: null,
    // Each side's picture has a size, a height on the page and an opacity of its
    // own. Null means that side's has never been set, and the three shared values
    // below are used: they are where these were kept before each side had its own.
    stickerLeftSize: null,
    stickerLeftPosition: null,
    stickerLeftOpacity: null,
    stickerRightSize: null,
    stickerRightPosition: null,
    stickerRightOpacity: null,
    stickerSize: 180,
    stickerPosition: 85,
    stickerOpacity: 1,
    // How far each side's picture has been dragged sideways from its usual place in
    // the empty space, in pixels. Null and 0 both mean not at all.
    stickerLeftShift: null,
    stickerRightShift: null,
    stickerShift: 0,
    // Chat text. A null colour and the "default" font leave Claude's own alone.
    // `codeColor` is for the words Claude marks like `this`, normally crimson.
    textColor: null,
    codeColor: null,
    font: "default",
    fontCustom: "",
    // The sidebar's text, set separately from the chat's.
    sidebarTextColor: null,
    sidebarFont: "default",
    sidebarFontCustom: ""
};

// Whether a main-page picture is stretched to its space when no zoom has been
// set: a landscape picture is. An upright or square one would be pulled badly out
// of shape, so it fills the page instead.
function stretches(width, height) {
    return width > height;
}

// Where one saved image's full-size picture is kept.
function imageKey(id) {
    return "image-" + id;
}

// Where one side picture's file is kept.
function stickerKey(id) {
    return "sticker-" + id;
}

// The name of one of a side picture's own settings. `side` is "left" or "right"
// and `what` is "Size", "Position" or "Opacity".
function sideKey(side, what) {
    return (side === "left" ? "stickerLeft" : "stickerRight") + what;
}

// That setting's value: the side's own if it has one, otherwise the shared one.
function sideValue(settings, side, what) {
    const own = settings[sideKey(side, what)];
    return own === null || own === undefined ? settings["sticker" + what] : own;
}

// Fonts that are already on most computers, so nothing has to be downloaded.
const fonts = [
    { id: "default", name: "Claude's own", family: null },
    { id: "sans", name: "Clean sans", family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { id: "serif", name: "Book serif", family: 'Georgia, "Times New Roman", serif' },
    { id: "rounded", name: "Rounded", family: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif' },
    { id: "typewriter", name: "Typewriter", family: '"American Typewriter", "Courier New", Courier, monospace' },
    { id: "mono", name: "Code", family: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
    { id: "hand", name: "Handwriting", family: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive' },
    { id: "custom", name: "Another font on this computer", family: null }
];

// The CSS font list for a font choice, or null to leave Claude's own font alone.
function fontFamily(id, custom) {
    if (id === "custom") {
        // Keep only the name itself, so nothing typed here can break the page's CSS.
        const name = custom.replace(/["\\;{}<>]/g, "").trim();
        return name ? `"${name}", system-ui, sans-serif` : null;
    }
    const font = fonts.find((item) => item.id === id);
    return font ? font.family : null;
}

// "#336699" as the three numbers claude.ai's older colour values use: "210 50% 40%".
function hslParts(hex) {
    const red = parseInt(hex.slice(1, 3), 16) / 255;
    const green = parseInt(hex.slice(3, 5), 16) / 255;
    const blue = parseInt(hex.slice(5, 7), 16) / 255;
    const most = Math.max(red, green, blue);
    const least = Math.min(red, green, blue);
    const light = (most + least) / 2;
    const spread = most - least;
    let hue = 0;
    let strength = 0;

    if (spread > 0) {
        strength = spread / (1 - Math.abs(2 * light - 1));
        if (most === red) hue = ((green - blue) / spread) % 6;
        else if (most === green) hue = (blue - red) / spread + 2;
        else hue = (red - green) / spread + 4;
    }
    hue = Math.round(hue * 60 + 360) % 360;
    return `${hue} ${Math.round(strength * 100)}% ${Math.round(light * 100)}%`;
}

// Presets are CSS gradients, so they need no image files. `light` marks a pale one, whose
// name is written in dark letters on its tile in the editor.
const presets = [
    {
        id: "dusk",
        name: "Dusk",
        css: "radial-gradient(circle at 15% 20%, rgba(255, 190, 150, 0.35), transparent 45%), linear-gradient(135deg, #1f3a5f, #7b3f61 55%, #d97757)"
    },
    {
        id: "aurora",
        name: "Aurora",
        css: "radial-gradient(circle at 80% 15%, rgba(120, 255, 200, 0.35), transparent 45%), linear-gradient(160deg, #0b3d3a, #1d6f6a 45%, #6c4ab6)"
    },
    {
        id: "ember",
        name: "Ember",
        css: "radial-gradient(circle at 75% 80%, rgba(255, 210, 120, 0.4), transparent 50%), linear-gradient(135deg, #3a0d0d, #a23b1e 55%, #f2a65a)"
    },
    {
        id: "ocean",
        name: "Ocean",
        css: "radial-gradient(circle at 25% 85%, rgba(150, 240, 255, 0.35), transparent 50%), linear-gradient(180deg, #0a2540, #1565a8 60%, #5ec4d6)"
    },
    {
        id: "forest",
        name: "Forest",
        css: "radial-gradient(circle at 80% 20%, rgba(230, 240, 150, 0.3), transparent 45%), linear-gradient(150deg, #0f2a1d, #2f6b3f 55%, #b7c66a)"
    },
    {
        id: "graphite",
        name: "Graphite",
        css: "radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.18), transparent 50%), linear-gradient(135deg, #1c1c1e, #4a4a4f 60%, #8a8a90)"
    },
    {
        id: "midnight",
        name: "Midnight",
        css: "radial-gradient(circle at 80% 15%, rgba(110, 140, 255, 0.22), transparent 45%), linear-gradient(160deg, #05070d, #0d1424 55%, #1a2440)"
    },
    {
        id: "paper",
        name: "Paper",
        light: true,
        css: "radial-gradient(circle at 20% 15%, rgba(255, 255, 255, 0.5), transparent 50%), linear-gradient(160deg, #f6efe0, #efe3cb 55%, #e3d2b0)"
    },
    {
        id: "mist",
        name: "Mist",
        light: true,
        css: "radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.5), transparent 50%), linear-gradient(170deg, #e8eef3, #cfdbe6 55%, #b4c6d6)"
    },
    {
        id: "blossom",
        name: "Blossom",
        light: true,
        css: "radial-gradient(circle at 75% 80%, rgba(255, 255, 255, 0.45), transparent 50%), linear-gradient(150deg, #fbe9ec, #f6cfd8 55%, #e8b3c6)"
    }
];

// The frames are black ink drawings. Each one is a small square picture: the browser
// cuts it into a 3 by 3 grid, keeps the corners and stretches or repeats the edge
// pieces along each side of the frame.
const ink = "#111";

function inkPicture(size, drawing) {
    const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="none" stroke="${ink}">${drawing}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(picture)}")`;
}

// A square outline, `inset` in from the edge of the picture.
function outline(size, inset, thickness, extra = "") {
    const side = size - inset * 2;
    return `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" stroke-width="${thickness}" ${extra}/>`;
}

// Makes a line uneven, as if drawn by hand. A bigger `amount` wanders further.
function wobble(id, amount, seed) {
    return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="${seed}"/>
        <feDisplacementMap in="SourceGraphic" scale="${amount}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`;
}

// One heavy line with ragged edges.
function brushPicture() {
    return inkPicture(1000, wobble("rough", 44, 3) + outline(1000, 50, 50, 'filter="url(#rough)"'));
}

// Three thin lines that wander over each other, like a border sketched in pen.
function sketchPicture() {
    return inkPicture(1000,
        wobble("first", 40, 11) + wobble("second", 40, 27) + wobble("third", 40, 42) +
        outline(1000, 40, 8, 'filter="url(#first)"') +
        outline(1000, 50, 8, 'filter="url(#second)"') +
        outline(1000, 60, 8, 'filter="url(#third)"'));
}

// Slanted pen strokes between two thin lines.
function hatchPicture() {
    return inkPicture(90,
        `<defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M-2,2 L2,-2 M0,10 L10,0 M8,12 L12,8" stroke-width="2.2"/>
        </pattern></defs>
        <path fill="url(#hatch)" stroke="none" fill-rule="evenodd" d="M0,0 H90 V90 H0 Z M30,30 V60 H60 V30 Z"/>` +
        outline(90, 1.5, 3) + outline(90, 28.5, 3));
}

// The Greek key pattern. One hook and one corner are drawn for the top left,
// then turned three times to make the other sides.
function keyPicture() {
    const turns = [90, 180, 270].map((angle) => `<use href="#key" transform="rotate(${angle} 45 45)"/>`);
    return inkPicture(90,
        `<g id="key" stroke-width="3" stroke-linecap="square">
            <path d="M30,27 H60 M54,27 V5 H34 V16 H45"/>
            <path d="M30,27 H27 V30"/>
            <rect x="8" y="8" width="11" height="11"/>
        </g>` + turns.join(""));
}

// A raised frame, for a pop-out look: four sloping sides lit from the top left,
// casting a soft shadow inwards onto the panel it surrounds.
function raisedPicture(top, left, right, bottom) {
    return inkPicture(300,
        `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
        <rect x="80" y="80" width="156" height="156" stroke="#000" stroke-opacity="0.55" stroke-width="16" filter="url(#soft)"/>
        <g stroke="none">
            <path fill="${top}" d="M0,0 H300 L228,72 H72 Z"/>
            <path fill="${right}" d="M300,0 V300 L228,228 V72 Z"/>
            <path fill="${bottom}" d="M300,300 H0 L72,228 H228 Z"/>
            <path fill="${left}" d="M0,300 V0 L72,72 V228 Z"/>
        </g>
        <rect x="1.5" y="1.5" width="297" height="297" stroke-width="3"/>
        <rect x="70.5" y="70.5" width="159" height="159" stroke-width="3"/>`);
}

// A frame is either a picture cut into edge pieces (source, slice, repeat)
// or a plain coloured border (color, radius). `scale` makes thin styles thin.
const frames = [
    {
        id: "fineliner",
        name: "Fineliner",
        source: "none",
        slice: "1",
        repeat: "stretch",
        color: ink,
        radius: "0px",
        shadow: "none",
        scale: 0.15
    },
    {
        id: "double",
        name: "Double rule",
        source: inkPicture(90, outline(90, 6, 12) + outline(90, 26, 4)),
        slice: "30",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "draft",
        name: "Draft",
        // Lines that cross and run past each corner, like a drafting drawing.
        source: inkPicture(90, `<path stroke-width="3" d="M0,20 H90 M0,70 H90 M20,0 V90 M70,0 V90"/>`),
        slice: "30",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "brush",
        name: "Brush",
        source: brushPicture(),
        slice: "100",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "sketch",
        name: "Sketch",
        source: sketchPicture(),
        slice: "100",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "hatching",
        name: "Hatching",
        source: hatchPicture(),
        slice: "30",
        repeat: "round",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1.4
    },
    {
        id: "key",
        name: "Greek key",
        source: keyPicture(),
        slice: "30",
        repeat: "round",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1.3
    },
    {
        id: "raised",
        name: "Pop-out",
        source: raisedPicture("#8a8a8a", "#636363", "#262626", "#141414"),
        slice: "100",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1.6
    },
    {
        id: "raised-pale",
        name: "Pop-out, pale",
        source: raisedPicture("#ffffff", "#e9e5da", "#a39f94", "#7d7a71"),
        slice: "100",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1.6
    }
];

// The values one frame needs, at a given thickness in pixels.
// `id` is a preset id, "custom" for the uploaded frame, or "none".
// Returns null when there is nothing to draw.
function frameValues(id, width, customUrl, customSlice) {
    let frame = frames.find((item) => item.id === id);

    if (id === "custom" && customUrl && customSlice) {
        frame = {
            source: `url("${customUrl}")`,
            slice: customSlice.join(" "),
            repeat: "stretch",
            color: "transparent",
            radius: "0px",
            shadow: "none",
            scale: 1
        };
    }
    if (!frame) {
        return null;
    }
    return {
        width: Math.max(1, Math.round(width * frame.scale)) + "px",
        color: frame.color,
        source: frame.source,
        slice: frame.slice,
        repeat: frame.repeat,
        radius: frame.radius,
        shadow: frame.shadow
    };
}
