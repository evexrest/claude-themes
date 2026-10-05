#!/usr/bin/env python3
"""Make the test pages for the popup and the upload page.

They are copies of the real popup.html and options.html with a stand-in for
Chrome's storage added at the top and a test script added at the bottom, so run
this again whenever either page changes.
"""
import pathlib

tests = pathlib.Path(__file__).resolve().parent
project = tests.parent
fragments = tests / "fragments"


def wrap(page, head, tail=""):
    text = (project / page).read_text()
    text = text.replace("<head>", "<head>" + (fragments / head).read_text(), 1)
    return text.replace("</body>", tail + "</body>", 1)


popup_tail = (fragments / "popup.tail.html").read_text()
options_tail = (fragments / "options.tail.html").read_text()

(tests / "popup-test.html").write_text(wrap("popup.html", "popup.head.html"))
(tests / "popup-logic.html").write_text(wrap("popup.html", "popup.head.html", popup_tail))
(tests / "options-logic.html").write_text(wrap("options.html", "options.head.html", options_tail))

# Every popup tab side by side, for a picture.
views = ["", "area=main&tab=text", "area=main&tab=borders", "area=main&tab=sides",
         "area=side", "area=side&side=own", "area=side&tab=text", "area=side&tab=borders"]
frames = "".join(f'<iframe src="popup-test.html?{view}"></iframe>' for view in views)
(tests / "popups.html").write_text(
    "<!DOCTYPE html><style>body{margin:8px;background:#888;display:grid;"
    "grid-template-columns:repeat(4,352px);gap:12px}"
    "iframe{width:352px;height:600px;border:0;background:#151515}</style>" + frames)
print("made popup-test.html, popup-logic.html, options-logic.html, popups.html")
