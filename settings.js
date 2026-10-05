// Shared by content.js, popup.js and options.js.

// Keep this the same as "version" in manifest.json. The popup compares the two to
// tell whether Chrome is still running an older copy of the extension.
const filesVersion = "0.2.0";

const defaults = {
    enabled: true,
    image: null,
    preset: "dusk",
    opacity: 0.5,
    panelOpacity: 0.6,
    frameLayout: "separate",
    frameSidebar: "none",
    frameMain: "none",
    frameAll: "none",
    frameWidth: 14,
    frameImage: null,
    frameSlice: null
};

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
