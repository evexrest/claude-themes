// Clicking the toolbar icon opens the editor in a tab of its own. If one is already
// open, it answers the message and comes to the front, so only one is ever open.
chrome.action.onClicked.addListener(async () => {
    try {
        if (await chrome.runtime.sendMessage({ type: "show-editor" })) {
            return;
        }
    } catch (error) {
        // No editor is open to answer.
    }
    chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });
});
