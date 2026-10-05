// A stand-in for Chrome's extension storage, for testing outside Chrome's extension system.
window.store = Object.assign({}, window.seed || {});
window.listeners = [];
window.messageListeners = [];
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
  action: { onClicked: { addListener(l) { window.iconClicked = l; } } },
  windows: { update() {} },
  runtime: { onMessage: { addListener(l) { messageListeners.push(l); } },
    sendMessage(message, sender = {}) { return new Promise((ok, no) => { if (!messageListeners.length) return no(new Error("no one listening")); let answered; messageListeners.forEach((l) => l(message, sender, (a) => { answered = a; })); ok(answered); }); },
    getManifest: () => ({ version: new URLSearchParams(location.search).get("v") || (typeof filesVersion === "string" ? filesVersion : "0") }), openOptionsPage() { window.openedOptions = true; }, getURL: (p) => 'chrome-extension://test/' + p },
  // `tabAnswers` says which tabs have a page that answers the toolbar icon; `claudeTabs` is what a search for Claude tabs finds.
  tabs: { create(o) { window.openedTab = o.url; return Promise.resolve({ id: 99 }); }, update(id, change) { window.frontedTab = change.active === true ? id : null; },
    sendMessage(id, message) { (window.asked = window.asked || []).push(id + ":" + message.type); return (window.tabAnswers || {})[id] ? Promise.resolve(true) : Promise.reject(new Error("no answer")); },
    query() { return Promise.resolve((window.claudeTabs || []).map((id) => ({ id }))); } }
};
window.colourImage = (colour, w = 4, h = 3) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = colour; x.fillRect(0, 0, w, h); return c.toDataURL("image/png"); };
window.wait = (ms) => new Promise((r) => setTimeout(r, ms));
