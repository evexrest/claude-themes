const frame = document.getElementById("frame");
const zoom = document.getElementById("zoom");
const editor = document.getElementById("editor");
const status = document.getElementById("status");
const context = frame.getContext("2d");

const moving = document.getElementById("moving");
const maxSavedWidth = 2560;
const maxMovingBytes = 25 * 1024 * 1024;

// The chosen file as stored text, when it is a GIF. A GIF is saved exactly as it
// is, because cropping it here would keep only its first frame.
let movingData = null;

// What the image is for: "main" (the whole screen) or "sidebar". The crop box is
// drawn in that shape. The editor opens this page with #sidebar for the second one.
let target = location.hash === "#sidebar" ? "sidebar" : "main";
let frameWidth = 720;
let frameHeight = 0;

let image = null;
let scale = 1;
let x = 0;
let y = 0;

// The smallest scale at which the image still fills the whole frame.
function coverScale() {
    return Math.max(frameWidth / image.width, frameHeight / image.height);
}

// The scale at which the whole image just fits inside the frame.
function wholeScale() {
    return Math.min(frameWidth / image.width, frameHeight / image.height);
}

// The scale for a place on the Zoom slider: 1 fills the frame, 0 fits the whole
// image in it, and above 1 is that many times the filling scale.
function zoomScale(value) {
    return value >= 1
        ? coverScale() * value
        : wholeScale() + (coverScale() - wholeScale()) * value;
}

// Keep the image where it belongs along one direction: `size` is the image's and
// `room` the frame's. An image bigger than the frame cannot be dragged so far that
// a gap shows; a smaller one stays in the middle.
function held(position, size, room) {
    return size <= room ? (room - size) / 2 : Math.min(0, Math.max(room - size, position));
}

function keepInside() {
    x = held(x, image.width * scale, frameWidth);
    y = held(y, image.height * scale, frameHeight);
}

// True when the image is zoomed out far enough to leave part of the frame empty.
function hasGap() {
    return image.width * scale < frameWidth - 0.5 || image.height * scale < frameHeight - 0.5;
}

function draw() {
    context.clearRect(0, 0, frameWidth, frameHeight);
    context.drawImage(image, x, y, image.width * scale, image.height * scale);
}

// Start again with the whole image fitted and centred in the frame.
function centre() {
    scale = coverScale();
    x = (frameWidth - image.width * scale) / 2;
    y = (frameHeight - image.height * scale) / 2;
    zoom.value = 1;
}

// Give the frame the shape of the screen, or of the sidebar: 288 wide and about
// as tall as the browser window.
function shapeFrame() {
    if (target === "sidebar") {
        frameHeight = 560;
        frameWidth = Math.round(frameHeight * 288 / (screen.height * 0.87));
    } else {
        frameWidth = 720;
        frameHeight = Math.round(frameWidth * screen.height / screen.width);
    }

    frame.width = frameWidth * devicePixelRatio;
    frame.height = frameHeight * devicePixelRatio;
    frame.style.width = target === "sidebar" ? frameWidth + "px" : "100%";
    frame.style.aspectRatio = `${frameWidth} / ${frameHeight}`;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    // The GIF preview takes the same shape.
    moving.style.width = frame.style.width;
    moving.style.aspectRatio = frame.style.aspectRatio;

    document.getElementById("for-main").setAttribute("aria-pressed", target === "main");
    document.getElementById("for-sidebar").setAttribute("aria-pressed", target === "sidebar");
    document.getElementById("shape-hint").textContent = target === "sidebar"
        ? "The box is the shape of the sidebar."
        : "The box is the shape of your screen.";

    if (image) {
        centre();
        draw();
    }
}

for (const choice of ["main", "sidebar"]) {
    document.getElementById("for-" + choice).addEventListener("click", () => {
        target = choice;
        shapeFrame();
    });
}

shapeFrame();

function loadImage(source) {
    const loaded = new Image();
    loaded.onload = () => {
        image = loaded;
        centre();
        showEditor(false);
        draw();
    };
    loaded.onerror = () => {
        status.textContent = "That file could not be opened as an image.";
    };
    loaded.src = source;
}

// Show the crop box for a still image, or the whole-picture preview for a GIF.
function showEditor(isMoving) {
    document.getElementById("crop").hidden = isMoving;
    document.getElementById("whole").hidden = !isMoving;
    editor.hidden = false;
}

document.getElementById("file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    status.textContent = "";
    movingData = null;

    if (file.type !== "image/gif") {
        loadImage(URL.createObjectURL(file));
        return;
    }
    if (file.size > maxMovingBytes) {
        status.textContent = "That GIF is over 25 MB. Please choose a smaller one.";
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        movingData = reader.result;
        moving.src = movingData;
        showEditor(true);
    };
    reader.onerror = () => {
        status.textContent = "That file could not be read.";
    };
    reader.readAsDataURL(file);
});

moving.addEventListener("error", () => {
    editor.hidden = true;
    movingData = null;
    status.textContent = "That file could not be opened as an image.";
});

// Zoom around the middle of the frame, so the centre stays where it is.
zoom.addEventListener("input", () => {
    const centreX = (frameWidth / 2 - x) / scale;
    const centreY = (frameHeight / 2 - y) / scale;
    scale = zoomScale(Number(zoom.value));
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

// A small still copy of a saved image, for the editor's library. `picture` is
// a canvas or an image, `width` and `height` its size.
function thumbnail(picture, width, height) {
    const small = document.createElement("canvas");
    small.width = 240;
    small.height = Math.round(small.width * height / width);
    const drawing = small.getContext("2d");
    // White underneath, for a picture with see-through parts.
    drawing.fillStyle = "#ffffff";
    drawing.fillRect(0, 0, small.width, small.height);
    drawing.drawImage(picture, 0, 0, small.width, small.height);
    return small.toDataURL("image/jpeg", 0.7);
}

// The cropped picture as stored text, and its small copy.
function croppedPicture() {
    // The part of the original image that is inside the frame.
    const cropX = -x / scale;
    const cropY = -y / scale;
    const cropWidth = frameWidth / scale;
    const cropHeight = frameHeight / scale;

    const output = document.createElement("canvas");
    output.width = Math.min(maxSavedWidth, Math.round(cropWidth));
    output.height = Math.round(output.width * frameHeight / frameWidth);

    // Zoomed out past filling the frame: the saved picture is the whole frame, with
    // the image where it sits in it and the rest see-through. A JPEG cannot be
    // see-through, so this one is saved as WebP.
    if (hasGap()) {
        const each = output.width / frameWidth;
        output.getContext("2d").drawImage(
            image, x * each, y * each, image.width * scale * each, image.height * scale * each
        );
        return {
            data: output.toDataURL("image/webp", 0.9),
            thumb: thumbnail(output, output.width, output.height)
        };
    }

    output.getContext("2d").drawImage(
        image, cropX, cropY, cropWidth, cropHeight,
        0, 0, output.width, output.height
    );
    return {
        data: output.toDataURL("image/jpeg", 0.85),
        thumb: thumbnail(output, output.width, output.height)
    };
}

document.getElementById("save").addEventListener("click", async () => {
    // A GIF is kept whole; anything else is cropped to the frame.
    const picture = movingData
        ? { data: movingData, thumb: thumbnail(moving, moving.naturalWidth, moving.naturalHeight), animated: true }
        : croppedPicture();

    // Each saved image gets its own id, so earlier ones are kept.
    const id = Date.now().toString(36);
    const saved = await chrome.storage.local.get({ images: [] });

    // Use it straight away, as the main background or as the sidebar's own picture.
    // A cropped picture was shaped to the screen here, so it fills the page. A GIF
    // was not, and gets the automatic zoom.
    const use = target === "sidebar"
        ? { sidebarMode: "own", sidebarPreset: null, sidebarImageId: id }
        : { preset: null, imageId: id, imageZoom: movingData ? null : 1 };

    try {
        await chrome.storage.local.set({
            [imageKey(id)]: picture.data,
            images: [...saved.images, { id: id, thumb: picture.thumb, animated: picture.animated === true }],
            enabled: true,
            ...use
        });
        status.textContent = "Saved to your images and set as the " +
            (target === "sidebar" ? "sidebar's picture" : "background") +
            ". You now have " + (saved.images.length + 1) + ". Switch between them in the editor, which the toolbar icon opens.";
    } catch (error) {
        status.textContent = "Could not save: " + error.message;
    }
});
