// Shared by content.js, popup.js and options.js.

const defaults = {
    enabled: true,
    image: null,
    preset: "dusk",
    opacity: 0.5,
    panelOpacity: 0.6
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
