// Shared by content.js, popup.js and options.js.

// Keep this the same as "version" in manifest.json. The popup compares the two to
// tell whether Chrome is still running an older copy of the extension.
const filesVersion = "0.3.0";

const defaults = {
    enabled: true,
    // The background is a preset, or one of the saved images when `preset` is null.
    preset: "dusk",
    imageId: null,
    // The saved images, as a list of { id, thumb }. `thumb` is a small copy for the
    // popup. Each full-size picture is stored separately, under imageKey(id).
    images: [],
    opacity: 0.5,
    panelOpacity: 0.6,
    frameLayout: "separate",
    frameSidebar: "none",
    frameMain: "none",
    frameAll: "none",
    frameWidth: 14,
    frameImage: null,
    frameSlice: null,
    // Chat text. A null colour and the "default" font leave Claude's own alone.
    textColor: null,
    font: "default",
    fontCustom: ""
};

// Where one saved image's full-size picture is kept.
function imageKey(id) {
    return "image-" + id;
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

// Presets are CSS gradients, so they need no image files.
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

// A raised slab, for a pop-out look: four sloping sides lit from the top left, with
// a soft shadow underneath. The outer part of the band is left empty so the shadow
// has room to fall on the background.
function raisedPicture(top, left, right, bottom) {
    return inkPicture(300,
        `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
        <rect x="47" y="53" width="220" height="220" fill="#000" fill-opacity="0.6" stroke="none" filter="url(#soft)"/>
        <g stroke="none">
            <path fill="${top}" d="M40,40 H260 L200,100 H100 Z"/>
            <path fill="${right}" d="M260,40 V260 L200,200 V100 Z"/>
            <path fill="${bottom}" d="M260,260 H40 L100,200 H200 Z"/>
            <path fill="${left}" d="M40,260 V40 L100,100 V200 Z"/>
        </g>
        <rect x="41.5" y="41.5" width="217" height="217" stroke-width="3"/>
        <rect x="98" y="98" width="104" height="104" stroke-width="3"/>`);
}

// A frame is either a picture cut into edge pieces (source, slice, repeat)
// or a plain coloured border (color, radius). `scale` makes thin styles thin.
// `clip: "padding-box"` keeps a panel's own colour out from under the frame.
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
        clip: "padding-box",
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
        clip: "padding-box",
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
        shadow: frame.shadow,
        clip: frame.clip || "border-box"
    };
}
