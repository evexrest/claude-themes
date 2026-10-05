// The "Pictures beside the chat" part of the options page.

const stickerEditor = document.getElementById("sticker-editor");
const stickerPreview = document.getElementById("sticker-preview");
const stickerStatus = document.getElementById("sticker-status");
const maxStickerBytes = 12 * 1024 * 1024;

// The chosen file as text that can be stored, exactly as it is, so a GIF keeps moving.
let stickerData = null;
// The id the chosen file was saved under, once it has been, so that putting the
// same picture on both sides saves it only once.
let stickerId = null;

document.getElementById("sticker-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    if (file.size > maxStickerBytes) {
        stickerStatus.textContent = "That file is over 12 MB. Please choose a smaller one.";
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        stickerData = reader.result;
        stickerId = null;
        stickerPreview.src = stickerData;
        stickerEditor.hidden = false;
        stickerStatus.textContent = "";
    };
    reader.onerror = () => {
        stickerStatus.textContent = "That file could not be read.";
    };
    reader.readAsDataURL(file);
});

stickerPreview.addEventListener("error", () => {
    stickerEditor.hidden = true;
    stickerData = null;
    stickerStatus.textContent = "That file could not be opened as an image.";
});

// A small still copy of the picture, for the editor's library.
function stickerThumbnail() {
    const small = document.createElement("canvas");
    const shrink = 96 / Math.max(stickerPreview.naturalWidth, stickerPreview.naturalHeight);
    small.width = Math.max(1, Math.round(stickerPreview.naturalWidth * shrink));
    small.height = Math.max(1, Math.round(stickerPreview.naturalHeight * shrink));
    small.getContext("2d").drawImage(stickerPreview, 0, 0, small.width, small.height);
    return small.toDataURL("image/png");
}

// Keep the picture and show it on one side. `key` is "stickerLeft" or "stickerRight".
async function saveSticker(key, sideName) {
    const change = { [key]: stickerId, enabled: true };

    if (!stickerId) {
        const id = Date.now().toString(36);
        const saved = await chrome.storage.local.get({ stickers: [] });
        change[stickerKey(id)] = stickerData;
        change.stickers = [...saved.stickers, { id: id, thumb: stickerThumbnail() }];
        change[key] = id;
    }

    try {
        await chrome.storage.local.set(change);
        stickerId = change[key];
        stickerStatus.textContent = "Saved, and showing on the " + sideName +
            ". Move and resize it in the editor, which the toolbar icon opens.";
    } catch (error) {
        stickerStatus.textContent = "Could not save: " + error.message;
    }
}

document.getElementById("sticker-left").addEventListener("click", () => {
    saveSticker("stickerLeft", "left");
});

document.getElementById("sticker-right").addEventListener("click", () => {
    saveSticker("stickerRight", "right");
});

// A link to this page ending in #sides comes straight to this part.
if (location.hash === "#sides") {
    document.getElementById("sides").scrollIntoView();
}
