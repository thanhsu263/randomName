"""Generate L1 background: SGU main building redrawn as a mushroom-village scene.

Output: sgu_bg_L1.svg (3840x1080, transparent sky, horizontally tileable).
Run:    python gen_sgu_bg.py
"""
import math
import random
from pathlib import Path

random.seed(11)
W, H = 3840, 1080
CX = W / 2
INK = "#2b1d14"
C = dict(
    wall="#f7c94e", wallsh="#e2a937", trim="#fdf7e8", trimsh="#e6dcc4",
    roof="#cf5532", roofdk="#a83c22", wood="#7a4a2c", wooddk="#5a3420",
    green="#3f9461", greendk="#2c6e45", glass="#3b5d73", stone="#d8ccb4", stonedk="#b3a68b",
    stripe="#6f93ad", emblem="#2563b8", grass="#7cc34f", grassdk="#5ea43a",
    yard="#e9b98a", yarddk="#cf946a", leaf="#3f8f3a", leafdk="#2c6f2c", leafhi="#62b14b",
    bark="#8d5b3b", barkdk="#6a4129", stem="#f7ecd2", gill="#e7d6ab",
)

out = []


def add(s):
    out.append(s)


def stroke(w):
    if not w:
        return 'stroke="none"'
    return f'stroke="{INK}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"'


def rect(x, y, w, h, fill, sw=5, rx=0, extra=""):
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" {stroke(sw)} {extra}/>')


def box(x0, y0, x1, y1, fill, sw=5, rx=0):
    rect(x0, y0, x1 - x0, y1 - y0, fill, sw, rx)


def path(d, fill, sw=5, extra=""):
    add(f'<path d="{d}" fill="{fill}" {stroke(sw)} {extra}/>')


def circ(cx, cy, r, fill, sw=5, extra=""):
    add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" {stroke(sw)} {extra}/>')


def line(x1, y1, x2, y2, color=INK, w=4, extra=""):
    add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{w}" stroke-linecap="round" {extra}/>')


def curve(d, color, w):
    add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def inked_curve(d, color, w):
    """Line with its own ink outline (for roots, rope, etc.)."""
    curve(d, INK, w + 6)
    curve(d, color, w)


def mx(x):
    return W - x


# ---------------------------------------------------------------- building parts

def tower():
    box(1872, 318, 1968, 480, C["wall"])
    box(1866, 410, 1974, 422, C["trim"], 4)
    box(1882, 330, 1958, 406, C["wooddk"], 4, 4)
    circ(1920, 368, 30, "#fffaf0", 4)
    for i in range(12):
        a = math.radians(i * 30)
        r0 = 22 if i % 3 else 19
        line(1920 + r0 * math.sin(a), 368 - r0 * math.cos(a), 1920 + 27 * math.sin(a), 368 - 27 * math.cos(a), INK, 2.5)
    line(1920, 368, 1920 + 15 * math.sin(math.radians(120)), 368 - 15 * math.cos(math.radians(120)), INK, 4.5)
    line(1920, 368, 1920, 344, INK, 3.5)
    circ(1920, 368, 3, INK, 0)
    # square red-tiled cap with flared eaves
    box(1828, 320, 2012, 332, C["wood"], 4)
    for bx in (1846, 1880, 1960, 1994):
        path(f"M{bx - 6} 332 L{bx} 348 L{bx + 6} 332 Z", C["wooddk"], 3)
    path("M1812 324 L1890 252 L1950 252 L2028 324 Q1920 332 1812 324 Z", "url(#tiles)")
    box(1884, 244, 1956, 256, C["roofdk"], 4, 5)
    line(1920, 244, 1920, 206, INK, 4)
    circ(1920, 200, 7, C["roofdk"], 4)


def wing(x0, x1, outer_left):
    # hip roof
    if outer_left:
        roof = f"M{x0 - 32} 574 L{x0 + 52} 470 L{x1} 470 L{x1} 574 Z"
        ridge = (x0 + 46, x1)
    else:
        roof = f"M{x0} 574 L{x0} 470 L{x1 - 52} 470 L{x1 + 32} 574 Z"
        ridge = (x0, x1 - 46)
    path(roof, "url(#tiles)")
    box(ridge[0], 462, ridge[1], 474, C["roofdk"], 4, 5)
    # eave underside + brackets
    ex0, ex1 = (x0 - 32, x1) if outer_left else (x0, x1 + 32)
    box(ex0, 572, ex1, 586, C["wood"], 4)
    for bx in range(int(x0) + 30, int(x1) - 10, 56):
        path(f"M{bx - 7} 586 L{bx} 604 L{bx + 7} 586 Z", C["wooddk"], 3)
    # wall
    box(x0, 584, x1, 960, C["wall"])
    box(x0 + 3, 587, x1 - 3, 600, C["wallsh"], 0)
    # floor cornice + plinth
    box(x0 - 8, 742, x1 + 8, 760, C["trim"], 4)
    box(x0 + 3, 760, x1 - 3, 769, C["wallsh"], 0)
    box(x0 - 6, 936, x1 + 6, 962, C["stone"], 4)
    # pilasters and bays
    pil = [x0 + 14 + i * (x1 - x0 - 28) / 4 for i in range(5)]
    for p in pil:
        box(p - 11, 600, p + 11, 742, C["trim"], 3.5)
        box(p - 11, 769, p + 11, 936, C["trim"], 3.5)
    for i in range(4):
        c = (pil[i] + pil[i + 1]) / 2
        upper_window(c)
        arch_door(c)


def upper_window(c):
    box(c - 34, 610, c + 34, 626, C["wooddk"], 3.5, 3)
    box(c - 44, 628, c + 44, 638, C["trim"], 3.5)
    box(c - 30, 638, c + 30, 728, C["glass"], 4)
    line(c, 640, c, 726, C["trim"], 3)
    line(c - 28, 672, c + 28, 672, C["trim"], 3)
    for sx in (c - 64, c + 32):
        box(sx, 638, sx + 32, 728, C["green"], 4, 3)
        for y in range(647, 724, 8):
            line(sx + 4, y, sx + 28, y, C["greendk"], 3)
    # little balustrade balcony
    box(c - 46, 700, c + 46, 708, C["trim"], 3.5, 2)
    for bx in range(int(c) - 40, int(c) + 41, 10):
        box(bx - 3, 708, bx + 3, 734, C["trim"], 2.5, 3)
    box(c - 52, 734, c + 52, 744, C["trim"], 4, 2)


def striped_arch(c, cy, r_in, r_out, segments):
    band = (f"M{c - r_out} {cy} A{r_out} {r_out} 0 0 1 {c + r_out} {cy} "
            f"L{c + r_in} {cy} A{r_in} {r_in} 0 0 0 {c - r_in} {cy} Z")
    path(band, C["trim"], 0)
    rm = (r_in + r_out) / 2
    dash = math.pi * rm / segments
    add(f'<path d="M{c - rm} {cy} A{rm} {rm} 0 0 1 {c + rm} {cy}" fill="none" '
        f'stroke="{C["stripe"]}" stroke-width="{r_out - r_in}" stroke-dasharray="{dash:.2f}"/>')
    path(band, "none", 4.5)


def arch_door(c):
    d = f"M{c - 40} 936 L{c - 40} 846 A40 40 0 0 1 {c + 40} 846 L{c + 40} 936 Z"
    path(d, C["wood"])
    for dx in (-20, 0, 20):
        line(c + dx, 852, c + dx, 930, C["wooddk"], 3)
    path(f"M{c - 40} 846 A40 40 0 0 1 {c + 40} 846 Z", C["glass"], 4)
    for a in (45, 90, 135):
        r = math.radians(a)
        line(c, 846, c - 38 * math.cos(r), 846 - 38 * math.sin(r), C["trim"], 3)
    circ(c - 7, 892, 3.5, "#e8c060", 2)
    circ(c + 7, 892, 3.5, "#e8c060", 2)
    box(c - 64, 846, c - 38, 856, C["trim"], 3.5)
    box(c + 38, 846, c + 64, 856, C["trim"], 3.5)
    striped_arch(c, 848, 40, 58, 11)
    box(c - 9, 782, c + 9, 800, C["trim"], 3.5, 2)
    box(c - 48, 930, c + 48, 940, C["stone"], 3.5)


def central_bay():
    x0, x1 = 1736, 2104
    # cast shadow of the projecting bay on the right wing
    box(x1, 600, x1 + 22, 936, C["wallsh"], 0)
    path(f"M{x0} 962 L{x0} 576 L1920 452 L{x1} 576 L{x1} 962 Z", C["wall"])
    # quoins
    for qx in (x0, x1 - 24):
        box(qx, 588, qx + 24, 936, C["trim"], 4)
        for y in range(618, 930, 30):
            line(qx + 3, y, qx + 21, y, C["trimsh"], 3)
    box(1726, 572, 2114, 588, C["trim"], 4)
    box(1726, 742, 2114, 760, C["trim"], 4)
    box(x0 + 26, 760, x1 - 26, 769, C["wallsh"], 0)
    box(1730, 936, 2110, 962, C["stone"], 4)
    # gable: striped arch + round emblem
    striped_arch(1920, 572, 72, 94, 13)
    circ(1920, 536, 30, C["emblem"], 4)
    add(f'<circle cx="1920" cy="536" r="23" fill="none" stroke="{C["trim"]}" stroke-width="3"/>')
    add(f'<text x="1920" y="542" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" '
        f'font-weight="bold" font-size="16" fill="{C["trim"]}">SGU</text>')
    # gable roof with wooden underside and brackets
    curve("M1712 606 L1920 464 L2128 606", C["wooddk"], 10)
    curve("M1688 600 L1920 440 L2152 600", INK, 46)
    curve("M1688 600 L1920 440 L2152 600", C["roof"], 36)
    curve("M1700 594 L1920 446 L2140 594", C["roofdk"], 4)
    for t in (0.22, 0.5, 0.78):
        bx = 1712 + (1920 - 1712) * t
        by = 606 - (606 - 464) * t
        path(f"M{bx} {by + 4} L{bx} {by + 22} L{bx + 14} {by - 4} Z", C["wooddk"], 3)
        path(f"M{mx(bx)} {by + 4} L{mx(bx)} {by + 22} L{mx(bx) - 14} {by - 4} Z", C["wooddk"], 3)
    # three tall louvered windows
    for c in (1868, 1920, 1972):
        path(f"M{c - 25} 742 L{c - 25} 631 A25 25 0 0 1 {c + 25} 631 L{c + 25} 742 Z", C["trim"], 4)
        path(f"M{c - 18} 736 L{c - 18} 633 A18 18 0 0 1 {c + 18} 633 L{c + 18} 736 Z", C["green"], 4)
        for y in range(642, 732, 8):
            line(c - 15, y, c + 15, y, C["greendk"], 3)
        line(c, 616, c, 734, C["greendk"], 3)
        box(c - 28, 734, c + 28, 744, C["trim"], 3.5)
    # entrance: columns, sign, double door
    for px in (1836, 1982):
        box(px, 808, px + 22, 936, C["trim"], 4)
        box(px - 6, 800, px + 28, 812, C["trim"], 3.5)
    box(1806, 762, 2034, 774, C["trim"], 4)
    box(1812, 774, 2028, 806, "#ffffff", 4, 4)
    add(f'<text x="1920" y="796" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" '
        f'font-weight="bold" font-size="15" textLength="192" lengthAdjust="spacingAndGlyphs" '
        f'fill="#1f4e8c">TRƯỜNG ĐẠI HỌC SÀI GÒN</text>')
    box(1866, 814, 1974, 936, C["wood"], 5)
    line(1920, 816, 1920, 934, C["wooddk"], 4)
    for dx in (1876, 1928):
        box(dx, 826, dx + 36, 870, C["wooddk"], 3, 3)
        box(dx, 882, dx + 36, 926, C["wooddk"], 3, 3)
    circ(1912, 880, 3.5, "#e8c060", 2)
    circ(1928, 880, 3.5, "#e8c060", 2)
    # wall lanterns
    for lx in (1800, 2040):
        line(lx, 838, lx, 852, INK, 4)
        path(f"M{lx - 9} 852 L{lx + 9} 852 L{lx + 6} 876 L{lx - 6} 876 Z", "#ffe28a", 3.5)
        path(f"M{lx - 11} 852 L{lx} 842 L{lx + 11} 852 Z", C["wooddk"], 3)


# ---------------------------------------------------------------- props

def banyan(cx):
    g = 985
    for dx, top, bot in ((-210, 600, 905), (-150, 620, 860), (185, 600, 915), (240, 610, 850), (120, 640, 890)):
        x = cx + dx
        inked_curve(f"M{x} {top} Q{x + 12} {top + 110} {x - 6} {top + 190} T{x + 4} {bot}", C["barkdk"], 4)
    trunk = (f"M{cx - 230} {g} Q{cx - 140} {g - 7} {cx - 95} 930 C{cx - 60} 880 {cx - 100} 800 {cx - 70} 720 "
             f"C{cx - 50} 660 {cx - 120} 620 {cx - 170} 560 L{cx - 120} 545 C{cx - 70} 600 {cx - 30} 620 {cx - 10} 600 "
             f"L{cx + 30} 556 C{cx + 40} 610 {cx + 80} 600 {cx + 150} 545 L{cx + 185} 565 "
             f"C{cx + 110} 630 {cx + 60} 660 {cx + 70} 740 C{cx + 80} 820 {cx + 60} 890 {cx + 110} 940 "
             f"Q{cx + 160} {g - 7} {cx + 240} {g} Q{cx + 120} {g + 7} {cx + 40} {g - 15} "
             f"Q{cx} {g} {cx - 40} {g - 15} Q{cx - 120} {g + 7} {cx - 230} {g} Z")
    path(trunk, C["bark"])
    for d in (f"M{cx - 60} 935 C{cx - 30} 860 {cx - 80} 800 {cx - 40} 720",
              f"M{cx + 40} 935 C{cx + 20} 850 {cx + 60} 790 {cx + 22} 700",
              f"M{cx - 20} 690 C{cx + 10} 650 {cx - 40} 615 {cx - 70} 585",
              f"M{cx + 30} 680 C{cx + 60} 640 {cx + 90} 610 {cx + 130} 575",
              f"M{cx - 150} {g - 6} Q{cx - 100} 965 {cx - 80} 945",
              f"M{cx + 160} {g - 6} Q{cx + 110} 965 {cx + 90} 945"):
        curve(d, C["barkdk"], 4)
    # hanging aerial roots in front of the trunk
    for dx, top, bot in ((-95, 620, 820), (75, 630, 840)):
        x = cx + dx
        inked_curve(f"M{x} {top} Q{x - 10} {top + 80} {x + 4} {(top + bot) / 2} T{x - 2} {bot}", C["barkdk"], 3.5)
    blobs = [(-280, 560, 95), (-200, 470, 120), (-80, 410, 140), (60, 390, 145), (190, 440, 130),
             (290, 530, 100), (-150, 575, 100), (0, 520, 130), (150, 565, 110), (230, 605, 70), (-250, 622, 62)]
    for dx, y, r in blobs:
        circ(cx + dx, y, r, C["leafdk"], 12)
    for dx, y, r in blobs:
        circ(cx + dx, y, r, C["leafdk"], 0)
    for dx, y, r in blobs:
        circ(cx + dx, y - 10, r - 12, C["leaf"], 0)
    for dx, y, r in blobs:
        circ(cx + dx - r * 0.22, y - r * 0.3, r * 0.5, C["leafhi"], 0)
    rnd = random.Random(int(cx))
    for dx, y, r in blobs:
        for _ in range(3):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(0.2, 0.7) * r
            x, yy = cx + dx + d * math.cos(a), y + d * math.sin(a)
            curve(f"M{x - 9:.1f} {yy - 4:.1f} Q{x:.1f} {yy + 6:.1f} {x + 9:.1f} {yy - 4:.1f}", C["leafdk"], 3.5)


def mushroom(x, base, h, cw, cap, spot, window=False):
    sw = cw * 0.32
    top = base - h
    path(f"M{x - sw} {base} Q{x - sw * 0.7} {base - h * 0.5} {x - sw * 0.75} {top} L{x + sw * 0.75} {top} "
         f"Q{x + sw * 0.7} {base - h * 0.5} {x + sw} {base} Q{x} {base + 8} {x - sw} {base} Z", C["stem"])
    curve(f"M{x + sw * 0.45} {top + 20} Q{x + sw * 0.45} {base - h * 0.45} {x + sw * 0.7} {base - 8}", C["gill"], 6)
    if window:
        wy = base - h * 0.42
        circ(x, wy, sw * 0.38, C["glass"], 4)
        line(x - sw * 0.38, wy, x + sw * 0.38, wy, C["trim"], 3)
        line(x, wy - sw * 0.38, x, wy + sw * 0.38, C["trim"], 3)
        path(f"M{x - sw * 0.42} {base} L{x - sw * 0.42} {base - h * 0.2} "
             f"A{sw * 0.42} {sw * 0.42} 0 0 1 {x + sw * 0.42} {base - h * 0.2} L{x + sw * 0.42} {base} Z", C["wood"], 4)
    add(f'<ellipse cx="{x:.1f}" cy="{top:.1f}" rx="{cw * 0.86:.1f}" ry="{cw * 0.13:.1f}" fill="{C["gill"]}" {stroke(4)}/>')
    ch = cw * 0.85
    path(f"M{x - cw} {top} C{x - cw * 1.02} {top - ch * 1.35} {x + cw * 1.02} {top - ch * 1.35} {x + cw} {top} "
         f"Q{x} {top + cw * 0.18} {x - cw} {top} Z", cap)
    for dx, dy, r in ((-0.55, -0.3, 0.16), (-0.05, -0.72, 0.13), (0.5, -0.42, 0.17),
                      (-0.2, -0.12, 0.09), (0.22, -0.16, 0.08), (0.78, -0.12, 0.08)):
        circ(x + dx * cw, top + dy * ch, r * cw, spot, 3.5)
    add(f'<ellipse cx="{x - cw * 0.5:.1f}" cy="{top - ch * 0.58:.1f}" rx="{cw * 0.09:.1f}" ry="{cw * 0.17:.1f}" '
        f'fill="#ffffff" opacity="0.45" transform="rotate(40 {x - cw * 0.5:.1f} {top - ch * 0.58:.1f})"/>')


def well(x, base):
    box(x - 54, 840, x - 42, 930, C["wood"], 4)
    box(x + 42, 840, x + 54, 930, C["wood"], 4)
    line(x - 42, 862, x + 42, 862, INK, 7)
    line(x - 42, 862, x + 42, 862, C["wooddk"], 3)
    curve(f"M{x} 862 L{x} 902", INK, 3)
    path(f"M{x - 12} 900 L{x + 12} 900 L{x + 9} 920 L{x - 9} 920 Z", C["wood"], 3.5)
    path(f"M{x - 82} 852 L{x} 792 L{x + 82} 852 Q{x} 860 {x - 82} 852 Z", "url(#tiles)")
    box(x - 6, 786, x + 6, 798, C["roofdk"], 3.5, 3)
    box(x - 62, base - 82, x + 62, base, C["stone"], 5, 12)
    for row, yy in enumerate(range(base - 66, base - 4, 16)):
        line(x - 58, yy, x + 58, yy, C["stonedk"], 3)
        off = 0 if row % 2 else 14
        for sx in range(int(x) - 48 + off, int(x) + 50, 28):
            line(sx, yy, sx, yy + 16 if yy + 16 < base - 4 else base - 6, C["stonedk"], 3)
    box(x - 70, base - 92, x + 70, base - 76, C["stonedk"], 4, 6)


def fence(x0, x1, base, h, step=26):
    box(x0 - 4, base - h * 0.75, x1 + 4, base - h * 0.62, C["wood"], 3.5, 3)
    box(x0 - 4, base - h * 0.35, x1 + 4, base - h * 0.22, C["wood"], 3.5, 3)
    x = x0
    while x <= x1:
        path(f"M{x - 8} {base} L{x - 8} {base - h + 8} Q{x} {base - h - 6} {x + 8} {base - h + 8} L{x + 8} {base} Z",
             "#a8774a", 3.5)
        x += step


def pot_plant(x, base):
    path(f"M{x - 22} {base - 34} L{x + 22} {base - 34} L{x + 16} {base} L{x - 16} {base} Z", "#b8613a", 4)
    line(x, base - 34, x, base - 52, INK, 5)
    for dx, dy, r in ((0, -78, 24), (-14, -62, 16), (14, -62, 16)):
        circ(x + dx, base + dy, r, C["leaf"], 4)
    circ(x - 6, base - 84, 9, C["leafhi"], 0)


def flower(x, y, r, petal, center):
    for i in range(5):
        a = math.radians(i * 72 - 90)
        circ(x + r * math.cos(a), y + r * math.sin(a), r * 0.75, petal, 2.5)
    circ(x, y, r * 0.6, center, 2.5)


# ---------------------------------------------------------------- tiling helpers

def wrapped(fn, *args):
    """Draw at x and its copies one tile left/right so edges match exactly."""
    for shift in (-W, 0, W):
        add(f'<g transform="translate({shift} 0)">')
        fn(*args)
        add("</g>")


def ground_band():
    top = "M0 960 " + " ".join("q60 -9 120 0 q60 9 120 0" for _ in range(W // 240))
    path(top + f" L{W} {H} L0 {H} Z", C["grass"], 0)
    curve(top, INK, 5)
    curve(top.replace("M0 960", "M0 976"), C["grassdk"], 4)


def yard():
    path("M1180 1080 Q1210 988 1320 984 L2520 984 Q2630 988 2660 1080 Z", C["yard"])
    for y in (1004, 1028, 1054):
        line(1300 if y < 1010 else 1240, y, 2540 if y < 1010 else 2600, y, C["yarddk"], 3)
    rnd = random.Random(3)
    for y0, y1 in ((984, 1004), (1004, 1028), (1028, 1054), (1054, 1080)):
        off = rnd.uniform(0, 60)
        x = 1300 + off
        while x < 2540:
            line(x, y0 + 3, x, y1 - 3, C["yarddk"], 3)
            x += 60
    box(1850, 936, 1990, 950, C["stone"], 4)
    box(1836, 950, 2004, 964, C["stone"], 4)
    box(1822, 964, 2018, 978, C["stone"], 4)


# ---------------------------------------------------------------- compose

def main():

    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    add("<defs>")
    add(f'<pattern id="tiles" width="30" height="24" patternUnits="userSpaceOnUse">'
        f'<rect width="30" height="24" fill="{C["roof"]}"/>'
        f'<path d="M0 12 Q7.5 3 15 12 Q22.5 3 30 12 M-7.5 24 Q0 15 7.5 24 Q15 15 22.5 24 Q30 15 37.5 24" '
        f'fill="none" stroke="{C["roofdk"]}" stroke-width="2.5"/></pattern>')
    add('<filter id="wobble" x="-3%" y="-3%" width="106%" height="106%">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="4" result="n"/>'
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>')
    add("</defs>")

    # building (wobbly ink)
    add('<g id="building" filter="url(#wobble)">')
    tower()
    wing(1060, 1736, True)
    wing(mx(1736), mx(1060), False)
    central_bay()
    add("</g>")

    # ground strip (tileable, no wobble so the seam stays exact)
    add('<g id="ground">')
    ground_band()
    yard()
    add("</g>")

    # props
    add('<g id="props" filter="url(#wobble)">')
    banyan(640)
    add(f'<g transform="translate({W} 0) scale(-1 1)">')
    banyan(640)
    add("</g>")
    fence(1110, 1320, 1020, 56)
    fence(mx(1320), mx(1110), 1020, 56)
    pot_plant(1806, 1000)
    pot_plant(2034, 1000)
    well(2440, 1022)
    mushroom(1010, 1000, 250, 112, "#e23b2e", "#ffffff", window=True)
    mushroom(1120, 1012, 105, 52, "#e23b2e", "#ffffff")
    mushroom(420, 1004, 125, 62, "#f08a24", "#fff1cf")
    mushroom(2860, 1004, 280, 122, "#3a7fd6", "#d9ecff", window=True)
    mushroom(2735, 1014, 140, 66, "#f08a24", "#fff1cf")
    mushroom(3440, 1006, 105, 50, "#3a7fd6", "#d9ecff")
    add("</g>")

    # edge-crossing fence, flowers and grass tufts: drawn with wrap copies
    add('<g id="wrap">')
    wrapped(fence, 3680, 4000, 1030, 64, 32)
    rnd = random.Random(21)
    petals = ["#ff7ab6", "#ffffff", "#ffd23f", "#b48cff", "#ff5a4f"]
    spots = []
    while len(spots) < 120:
        x, y = rnd.uniform(0, W), rnd.uniform(992, 1068)
        if 1150 < x < 2690 and y < 1075:
            continue
        spots.append((x, y))
    for x, y in spots:
        if rnd.random() < 0.55:
            p = rnd.choice(petals)
            wrapped(flower, x, y, rnd.uniform(5, 8), p, "#f5a623" if p != "#ffd23f" else "#e2572b")
        else:
            d = f"M{x - 8:.1f} {y:.1f} q2 -14 6 0 q3 -18 6 0 q3 -14 6 0"
            for shift in (-W, 0, W):
                add(f'<path transform="translate({shift} 0)" d="{d}" fill="none" stroke="{C["grassdk"]}" '
                    f'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
    add("</g>")
    add("</svg>")

    dst = Path(__file__).with_name("sgu_bg_L1.svg")
    dst.write_text("\n".join(out), encoding="utf-8")
    print(f"wrote {dst} ({dst.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
