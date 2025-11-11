#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent
ASSETS = ROOT / "assets"
CATS = ["weapons","items","maps","arcs"]

def img_size(p: Path):
    try:
        with Image.open(p) as im:
            return im.width, im.height
    except Exception:
        return None, None

rows = []
for cat in CATS:
    d = ASSETS / cat
    if not d.exists(): 
        continue
    for p in d.rglob("*"):
        if not p.is_file(): 
            continue
        if p.suffix.lower() not in {".png",".jpg",".jpeg",".webp",".gif",".avif",".svg"}:
            continue
        rel = f"{cat}/{p.name}"
        w,h = img_size(p)
        rows.append({
            "category":cat, "rel_path":rel, "file_name":p.name,
            "file_size":p.stat().st_size, "width":w, "height":h, "name":p.stem
        })

out = ASSETS / "index.json"
out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {out} ({len(rows)} items)")
