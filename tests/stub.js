// A stand-in for Chrome's extension storage, for testing outside Chrome's extension system.
window.store = Object.assign({}, window.seed || {});
window.listeners = [];
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
window.chrome = {
  storage: {
    local: {
      async get(keys) {
        await new Promise((r) => setTimeout(r, 5));
        const out = {};
        if (typeof keys === "string") { if (keys in store) out[keys] = clone(store[keys]); return out; }
        for (const k of Object.keys(keys)) out[k] = k in store ? clone(store[k]) : keys[k];
        return out;
      },
      async set(change) {
        const changes = {};
        for (const k of Object.keys(change)) { changes[k] = { oldValue: clone(store[k]), newValue: clone(change[k]) }; store[k] = clone(change[k]); }
        setTimeout(() => listeners.forEach((l) => l(changes)), 1);
      },
      async remove(key) {
        const changes = { [key]: { oldValue: store[key] } };
        delete store[key];
        setTimeout(() => listeners.forEach((l) => l(changes)), 1);
      }
    },
    onChanged: { addListener(l) { listeners.push(l); } }
  },
  runtime: { getManifest: () => ({ version: new URLSearchParams(location.search).get("v") || "0.7.1" }), openOptionsPage() { window.openedOptions = true; }, getURL: (p) => 'ext://' + p },
  tabs: { create(o) { window.openedTab = o.url; } }
};
window.colourImage = (colour, w = 4, h = 3) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = colour; x.fillRect(0, 0, w, h); return c.toDataURL("image/png"); };
window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
