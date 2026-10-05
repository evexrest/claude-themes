// `defaults` and `presets` come from settings.js.

const choices = document.getElementById("choices");
const enabled = document.getElementById("enabled");
const opacity = document.getElementById("opacity");
const panel = document.getElementById("panel");

function save(change) {
    chrome.storage.local.set(change);
}

function addChoice(name, background, selected, change) {
    const button = document.createElement("button");
    button.className = "choice";
    button.style.backgroundImage = background;
    button.setAttribute("aria-pressed", selected);

    const label = document.createElement("span");
    label.textContent = name;
    button.appendChild(label);

    button.addEventListener("click", () => {
        for (const other of choices.children) {
            other.setAttribute("aria-pressed", other === button);
        }
        save(change);
    });
    choices.appendChild(button);
}

function showPercent(slider, id) {
    document.getElementById(id).textContent = slider.value + "%";
}

async function start() {
    const settings = await chrome.storage.local.get(defaults);

    for (const preset of presets) {
        addChoice(preset.name, preset.css, settings.preset === preset.id, { preset: preset.id });
    }
    if (settings.image) {
        addChoice("Your image", `url("${settings.image}")`, !settings.preset, { preset: null });
    }

    enabled.checked = settings.enabled;
    opacity.value = Math.round(settings.opacity * 100);
    panel.value = Math.round(settings.panelOpacity * 100);
    showPercent(opacity, "opacity-value");
    showPercent(panel, "panel-value");

    enabled.addEventListener("change", () => {
        save({ enabled: enabled.checked });
    });

    opacity.addEventListener("input", () => {
        showPercent(opacity, "opacity-value");
        save({ opacity: opacity.value / 100 });
    });

    panel.addEventListener("input", () => {
        showPercent(panel, "panel-value");
        save({ panelOpacity: panel.value / 100 });
    });

    document.getElementById("choose").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}

start();
