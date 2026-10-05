// The toolbar icon opens the editor laid over the Claude page.

const claude = "https://claude.ai/";

// A Claude tab this script opened, which should show the editor once it has loaded.
let waitingTab = null;

// Ask a tab's page to open or close the editor. A tab that is not claude.ai does
// not answer, and nor does one opened before the extension was last reloaded.
async function ask(tabId, type) {
    try {
        return await chrome.tabs.sendMessage(tabId, { type: type }) === true;
    } catch (error) {
        return false;
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    // On a Claude tab: open the editor there, or close it if it is open.
    if (tab && tab.id !== undefined && await ask(tab.id, "toggle-editor")) {
        return;
    }

    // On any other tab: go to a Claude tab in this window and open it there.
    const tabs = await chrome.tabs.query({ url: claude + "*", currentWindow: true });
    for (const other of tabs) {
        if (await ask(other.id, "open-editor")) {
            chrome.tabs.update(other.id, { active: true });
            return;
        }
    }

    // There are Claude tabs but none answered: they need refreshing first. Until
    // then the editor opens in a tab of its own, and says so.
    if (tabs.length > 0) {
        chrome.tabs.create({ url: chrome.runtime.getURL("editor.html?why=refresh") });
        return;
    }

    // No Claude tab at all: open one. It asks below whether to show the editor.
    const made = await chrome.tabs.create({ url: claude + "new" });
    waitingTab = made.id;
});

chrome.runtime.onMessage.addListener((message, sender, answer) => {
    if (message && message.type === "page-ready" && sender.tab) {
        const open = sender.tab.id === waitingTab;
        if (open) {
            waitingTab = null;
        }
        answer({ open: open });
    }
});
