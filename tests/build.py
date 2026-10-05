#!/usr/bin/env python3
"""Make the test pages for the editor and the upload page.

They are copies of the real editor.html, preview.html and options.html with a
stand-in for Chrome's storage added at the top and a test script added at the
bottom, so run this again whenever one of those pages changes.
"""
import pathlib

tests = pathlib.Path(__file__).resolve().parent
project = tests.parent
fragments = tests / "fragments"


def wrap(page, head, tail=""):
    text = (project / page).read_text()
    text = text.replace("<head>", "<head>" + (fragments / head).read_text(), 1)
    return text.replace("</body>", tail + "</body>", 1)


# The editor shows preview.html in a frame. The test copy of the editor shows the
# test copy of the preview, which borrows the editor's stand-in for Chrome.
def editor(tail=""):
    return wrap("editor.html", "editor.head.html", tail).replace('src="preview.html"', 'src="tests/preview-test.html"', 1)


editor_tail = (fragments / "editor.tail.html").read_text()
options_tail = (fragments / "options.tail.html").read_text()

(tests / "preview-test.html").write_text(wrap("preview.html", "preview.head.html"))
(tests / "editor-test.html").write_text(editor())
(tests / "editor-logic.html").write_text(editor(editor_tail))
(tests / "options-logic.html").write_text(wrap("options.html", "options.head.html", options_tail))
print("made preview-test.html, editor-test.html, editor-logic.html, options-logic.html")
