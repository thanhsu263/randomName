"""Generate the kid sprite SVGs and render each to a transparent PNG with headless Edge."""
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import gen_kid_sprites
import gen_props
import gen_wizard_sprites

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SPRITES = Path(__file__).parent / "sprites"


def render(svg: Path):
    w, h = map(int, re.search(r'width="(\d+)" height="(\d+)"', svg.read_text(encoding="utf-8")[:300]).groups())
    png = svg.with_suffix(".png")
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--default-background-color=00000000", "--virtual-time-budget=4000",
                    f"--user-data-dir={SPRITES / '.edge' / svg.stem}",
                    f"--window-size={w},{h}", f"--screenshot={png}", svg.resolve().as_uri()],
                   check=True, capture_output=True)
    return png.name


if __name__ == "__main__":
    gen_kid_sprites.main()
    gen_wizard_sprites.main()
    gen_props.main()
    only = sys.argv[1:]
    svgs = [p for p in sorted(SPRITES.glob("*.svg")) if not only or any(o in p.stem for o in only)]
    with ThreadPoolExecutor(6) as ex:
        for name in ex.map(render, svgs):
            print("rendered", name)
    import shutil
    shutil.rmtree(SPRITES / ".edge", ignore_errors=True)
