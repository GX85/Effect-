"""Validate and package the browser-only export without any hosting credentials."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re

project = Path(__file__).resolve().parents[1]
root = project / "dist" / "client"
archive = project.parents[1] / "outputs" / "Focus-hosting.zip"
expected = ["index.html", "404.html", "start/index.html", "work/index.html",
            "work/opal-coffee/index.html", "work/envoid/index.html",
            "work/rapid/index.html", "work/rapid/howitworks/index.html",
            "work/rapid/iknowhow/index.html", "work/rapid/imapro/index.html",
            "effect/index.html", "effect/studio/index.html",
            "models/rapid-racing-bike.glb", "models/ATTRIBUTION.txt", "READ-ME.txt"]
for name in expected:
    assert (root / name).is_file(), "Missing required export: " + name

missing = set()
def check_url(value, parent):
    url = urlsplit(value)
    if url.scheme or url.netloc or not url.path:
        return
    path = root / unquote(url.path.lstrip("/")) if url.path.startswith("/") else parent / unquote(url.path)
    if not path.exists():
        missing.add(str(path.relative_to(root)))

class References(HTMLParser):
    def __init__(self, parent):
        super().__init__()
        self.parent = parent
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href", "poster"):
            if key in attrs:
                check_url(attrs[key], self.parent)

html_files = list(root.rglob("*.html"))
for page in html_files:
    References(page.parent).feed(page.read_text(encoding="utf-8"))
for css in root.rglob("*.css"):
    for value in re.findall(r"url\([\"']?([^\"')]+)", css.read_text(encoding="utf-8")):
        check_url(value, css.parent)
assert not missing, "Broken local references: " + ", ".join(sorted(missing))
assert "Focus" in (root / "index.html").read_text(encoding="utf-8")
assert "Engineered" in (root / "work/rapid/index.html").read_text(encoding="utf-8")

archive.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(archive, "w", ZIP_DEFLATED, compresslevel=9) as output:
    for path in sorted(root.rglob("*")):
        if path.is_file() and ".vite" not in path.relative_to(root).parts:
            output.write(path, path.relative_to(root).as_posix())
with ZipFile(archive) as packed:
    assert packed.testzip() is None, "ZIP integrity check failed"
    for name in expected:
        assert name in packed.namelist(), "ZIP missing: " + name
    count = len(packed.namelist())
print(json.dumps({"archive": str(archive), "files": count, "html_files": len(html_files),
                  "bytes": archive.stat().st_size, "broken_references": len(missing)}))
