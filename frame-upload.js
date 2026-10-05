// The "Your own frame" part of the options page.

const borderEditor = document.getElementById("border-editor");
const borderPreview = document.getElementById("border-preview");
const borderStatus = document.getElementById("border-status");
const maxFrameSize = 1400;

// The frame that is being previewed: { url, slice, hole }.
let pending = null;

// Shrink the picture if it is very large, then measure how thick the frame is
// on each side by walking outwards from the middle until the picture stops
// being see-through.
function readFrame(picture) {
    const shrink = Math.min(1, maxFrameSize / Math.max(picture.width, picture.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(picture.width * shrink);
    canvas.height = Math.round(picture.height * shrink);
    const context = canvas.getContext("2d");
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const middleX = Math.floor(canvas.width / 2);
    const middleY = Math.floor(canvas.height / 2);

    function solid(x, y) {
        return pixels[(y * canvas.width + x) * 4 + 3] > 128;
    }

    const hole = !solid(middleX, middleY);
    let slice;

    if (hole) {
        let top = middleY;
        let bottom = middleY;
        let left = middleX;
        let right = middleX;
        while (top > 0 && !solid(middleX, top - 1)) top--;
        while (bottom < canvas.height - 1 && !solid(middleX, bottom + 1)) bottom++;
        while (left > 0 && !solid(left - 1, middleY)) left--;
        while (right < canvas.width - 1 && !solid(right + 1, middleY)) right++;
        slice = [top, canvas.width - 1 - right, canvas.height - 1 - bottom, left];
    } else {
        // No see-through middle to measure, so guess the frame's thickness.
        const guess = Math.round(Math.min(canvas.width, canvas.height) * 0.12);
        slice = [guess, guess, guess, guess];
    }

    return {
        url: canvas.toDataURL("image/png"),
        slice: slice.map((side) => Math.max(1, side)),
        hole: hole
    };
}

function showFrame(frame) {
    pending = frame;
    borderPreview.style.borderImageSource = `url("${frame.url}")`;
    borderPreview.style.borderImageSlice = frame.slice.join(" ");
    borderEditor.hidden = false;
}

document.getElementById("border-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    const picture = new Image();
    picture.onload = () => {
        const frame = readFrame(picture);
        showFrame(frame);
        borderStatus.textContent = frame.hole
            ? ""
            : "This picture has no see-through middle, so the frame's thickness was guessed.";
    };
    picture.onerror = () => {
        borderStatus.textContent = "That file could not be opened as an image.";
    };
    picture.src = URL.createObjectURL(file);
});

document.getElementById("border-save").addEventListener("click", async () => {
    try {
        await chrome.storage.local.set({
            frameImage: pending.url,
            frameSlice: pending.slice
        });
        borderStatus.textContent = "Saved. Pick \"Your frame\" under Border in the editor to use it.";
    } catch (error) {
        borderStatus.textContent = "Could not save: " + error.message;
    }
});

document.getElementById("border-remove").addEventListener("click", async () => {
    const saved = await chrome.storage.local.get(defaults);
    const change = { frameImage: null, frameSlice: null };
    // Anything that was using the removed frame goes back to no border.
    for (const key of ["frameSidebar", "frameMain", "frameAll"]) {
        if (saved[key] === "custom") {
            change[key] = "none";
        }
    }
    await chrome.storage.local.set(change);
    borderEditor.hidden = true;
    borderStatus.textContent = "Your frame was removed.";
});

async function showSavedFrame() {
    const saved = await chrome.storage.local.get({ frameImage: null, frameSlice: null });
    if (saved.frameImage) {
        showFrame({ url: saved.frameImage, slice: saved.frameSlice, hole: true });
    }
}

showSavedFrame();
