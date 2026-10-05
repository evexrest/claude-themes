// Shared by content.js, popup.js and options.js.

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

// A ring of bubbles, drawn as a small picture. The browser cuts it into a 3 by 3
// grid and repeats the edge pieces along each side of the frame.
function bubbleImage(tint) {
    const spots = [[15, 15], [45, 15], [75, 15], [15, 45], [75, 45], [15, 75], [45, 75], [75, 75]];
    let circles = "";
    for (const [x, y] of spots) {
        circles += `<circle cx="${x}" cy="${y}" r="13.5" fill="url(#shine)" stroke="white" stroke-opacity="0.85"/>`;
    }
    const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90">
        <defs><radialGradient id="shine" cx="35%" cy="30%" r="75%">
            <stop offset="0" stop-color="white" stop-opacity="0.95"/>
            <stop offset="0.35" stop-color="white" stop-opacity="0.45"/>
            <stop offset="1" stop-color="${tint}" stop-opacity="0.8"/>
        </radialGradient></defs>${circles}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(picture)}")`;
}

// A frame is either a picture cut into edge pieces (source, slice, repeat)
// or a plain coloured border (color, radius). `scale` makes thin styles thin.
const frames = [
    {
        id: "bubbles",
        name: "Bubbles",
        source: bubbleImage("#bfe3ff"),
        slice: "30",
        repeat: "round",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "bubblegum",
        name: "Bubblegum",
        source: bubbleImage("#ff9ecf"),
        slice: "30",
        repeat: "round",
        color: "transparent",
        radius: "0px",
        shadow: "none",
        scale: 1
    },
    {
        id: "pop",
        name: "Pop",
        source: "none",
        slice: "1",
        repeat: "stretch",
        color: "rgba(255, 255, 255, 0.85)",
        radius: "28px",
        shadow: "0 12px 40px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.35), inset 0 6px 16px rgba(255, 255, 255, 0.25)",
        scale: 1
    },
    {
        id: "neon",
        name: "Neon",
        source: "none",
        slice: "1",
        repeat: "stretch",
        color: "#5ff",
        radius: "14px",
        shadow: "0 0 14px #5ff, inset 0 0 14px rgba(85, 255, 255, 0.6)",
        scale: 0.25
    },
    {
        id: "gold",
        name: "Gold",
        source: "linear-gradient(135deg, #7a5a12, #f7e58a 25%, #b98a2c 50%, #fff2a6 75%, #7a5a12)",
        slice: "1",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "0 6px 24px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.45), inset 0 0 14px rgba(0, 0, 0, 0.5)",
        scale: 1
    },
    {
        id: "walnut",
        name: "Walnut",
        source: "linear-gradient(135deg, #3b2412, #7a4f2a 30%, #5a3a1c 50%, #8a5c33 70%, #3b2412)",
        slice: "1",
        repeat: "stretch",
        color: "transparent",
        radius: "0px",
        shadow: "0 6px 24px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.5), inset 0 0 14px rgba(0, 0, 0, 0.55)",
        scale: 1
    },
    {
        id: "glass",
        name: "Glass",
        source: "none",
        slice: "1",
        repeat: "stretch",
        color: "rgba(255, 255, 255, 0.3)",
        radius: "18px",
        shadow: "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
        scale: 0.15
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
