const frame = document.getElementById("frame");
const zoom = document.getElementById("zoom");
const editor = document.getElementById("editor");
const status = document.getElementById("status");
const context = frame.getContext("2d");

// The frame is drawn 720 wide, in the same shape as the screen.
const frameWidth = 720;
const frameHeight = Math.round(frameWidth * screen.height / screen.width);
const maxSavedWidth = 2560;

let image = null;
let scale = 1;
let x = 0;
let y = 0;

frame.width = frameWidth * devicePixelRatio;
frame.height = frameHeight * devicePixelRatio;
frame.style.aspectRatio = `${frameWidth} / ${frameHeight}`;
context.scale(devicePixelRatio, devicePixelRatio);

// The smallest scale at which the image still fills the whole frame.
function coverScale() {
    return Math.max(frameWidth / image.width, frameHeight / image.height);
}

// Stop the image from being dragged so far that the frame shows a gap.
function keepInside() {
    x = Math.min(0, Math.max(frameWidth - image.width * scale, x));
    y = Math.min(0, Math.max(frameHeight - image.height * scale, y));
}

function draw() {
    context.clearRect(0, 0, frameWidth, frameHeight);
    context.drawImage(image, x, y, image.width * scale, image.height * scale);
}

function loadImage(source) {
    const loaded = new Image();
    loaded.onload = () => {
        image = loaded;
        scale = coverScale();
        x = (frameWidth - image.width * scale) / 2;
        y = (frameHeight - image.height * scale) / 2;
        zoom.value = 1;
        editor.hidden = false;
        draw();
    };
    loaded.onerror = () => {
        status.textContent = "That file could not be opened as an image.";
    };
    loaded.src = source;
}

document.getElementById("file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        status.textContent = "";
        loadImage(URL.createObjectURL(file));
    }
});

// Zoom around the middle of the frame, so the centre stays where it is.
zoom.addEventListener("input", () => {
    const centreX = (frameWidth / 2 - x) / scale;
    const centreY = (frameHeight / 2 - y) / scale;
    scale = coverScale() * zoom.value;
    x = frameWidth / 2 - centreX * scale;
    y = frameHeight / 2 - centreY * scale;
    keepInside();
    draw();
});

let dragging = false;

frame.addEventListener("pointerdown", (event) => {
    dragging = true;
    frame.setPointerCapture(event.pointerId);
    frame.classList.add("dragging");
});

frame.addEventListener("pointermove", (event) => {
    if (!dragging) {
        return;
    }
    // The frame can be shown narrower than 720 on a small window.
    const shown = frameWidth / frame.clientWidth;
    x += event.movementX * shown;
    y += event.movementY * shown;
    keepInside();
    draw();
});

frame.addEventListener("pointerup", () => {
    dragging = false;
    frame.classList.remove("dragging");
});

document.getElementById("save").addEventListener("click", async () => {
    // The part of the original image that is inside the frame.
    const cropX = -x / scale;
    const cropY = -y / scale;
    const cropWidth = frameWidth / scale;
    const cropHeight = frameHeight / scale;

    const output = document.createElement("canvas");
    output.width = Math.min(maxSavedWidth, Math.round(cropWidth));
    output.height = Math.round(output.width * frameHeight / frameWidth);
    output.getContext("2d").drawImage(
        image, cropX, cropY, cropWidth, cropHeight,
        0, 0, output.width, output.height
    );

    try {
        await chrome.storage.local.set({
            image: output.toDataURL("image/jpeg", 0.85),
            preset: null,
            enabled: true
        });
        status.textContent = "Saved. Open or reload claude.ai to see it.";
    } catch (error) {
        status.textContent = "Could not save: " + error.message;
    }
});

document.getElementById("remove").addEventListener("click", async () => {
    await chrome.storage.local.set({ image: null, preset: defaults.preset });
    editor.hidden = true;
    status.textContent = "Your image was removed. The background is back to a preset.";
});

async function showSaved() {
    const saved = await chrome.storage.local.get({ image: null });
    if (saved.image) {
        loadImage(saved.image);
    }
}

showSaved();
