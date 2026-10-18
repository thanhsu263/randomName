"""Generate parallax layers L0, L2, L3, L4 in the same ink style as the L1 building.

Output: sgu_bg_L0.svg, sgu_bg_L2.svg, sgu_bg_L3.svg, sgu_bg_L4.svg (3840x1080, tileable).
Run:    python gen_layers.py
"""
import math
import random
from pathlib import Path

import gen_sgu_bg as k
from gen_sgu_bg import W, H, INK, C, add, box, path, circ, line, curve, inked_curve, flower, fence, mushroom

HERE = Path(__file__).parent


def begin():
    k.out.clear()
    add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    add("<defs>")
    add(f'<pattern id="tiles" width="30" height="24" patternUnits="userSpaceOnUse">'
        f'<rect width="30" height="24" fill="{C["roof"]}"/>'
        f'<path d="M0 12 Q7.5 3 15 12 Q22.5 3 30 12 M-7.5 24 Q0 15 7.5 24 Q15 15 22.5 24 Q30 15 37.5 24" '
        f'fill="none" stroke="{C["roofdk"]}" stroke-width="2.5"/></pattern>')
    add('<filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">'
        '<feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="4" result="n"/>'
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>')
    add("</defs>")


def end(name):
    add("</svg>")
    dst = HERE / name
    dst.write_text("\n".join(k.out), encoding="utf-8")
    print(f"wrote {dst.name} ({dst.stat().st_size // 1024} KB)")


def place(fn, *args, x0, x1, wobble=True):
    """Draw fn(*args); if its extent [x0, x1] nears an edge, also draw a copy one tile over.

    The filter sits inside the translated group, so its noise is computed in the
    object's own coordinates and both copies come out pixel-identical.
    """
    shifts = [0]
    if x0 < 12:
        shifts.append(W)
    if x1 > W - 12:
        shifts.append(-W)
    for s in shifts:
        add(f'<g transform="translate({s} 0)">' + ('<g filter="url(#wobble)">' if wobble else "<g>"))
        fn(*args)
        add("</g></g>")


def wave(y, amp, period, x0=0, x1=W):
    """Open path along y with a tileable wave (period must divide W)."""
    half = period / 2
    segs = " ".join(f"q{half / 2:.1f} {-amp} {half:.1f} 0 q{half / 2:.1f} {amp} {half:.1f} 0"
                    for _ in range(int((x1 - x0) // period)))
    return f"M{x0} {y} {segs}"


def blob_cluster(cx, blobs, dark, mid, light, ink_w=10, tufts=True, seed=0):
    for dx, y, r in blobs:
        circ(cx + dx, y, r, dark, ink_w)
    for dx, y, r in blobs:
        circ(cx + dx, y, r, dark, 0)
    for dx, y, r in blobs:
        circ(cx + dx, y - r * 0.08, r * 0.9, mid, 0)
    for dx, y, r in blobs:
        circ(cx + dx - r * 0.22, y - r * 0.3, r * 0.5, light, 0)
    if tufts:
        rnd = random.Random(seed)
        for dx, y, r in blobs:
            for _ in range(2):
                a = rnd.uniform(0, 2 * math.pi)
                d = rnd.uniform(0.2, 0.65) * r
                x, yy = cx + dx + d * math.cos(a), y + d * math.sin(a)
                curve(f"M{x - 8:.1f} {yy - 4:.1f} Q{x:.1f} {yy + 5:.1f} {x + 8:.1f} {yy - 4:.1f}", dark, 3.5)


# ============================================================== L0 sky

def cloud(x, y, s):
    blobs = [(-95, 12, 42), (-45, -18, 58), (25, -32, 68), (88, -2, 50), (0, 14, 52), (-130, 30, 30), (135, 28, 32)]
    blobs = [(dx * s, y + dy * s, r * s) for dx, dy, r in blobs]
    for dx, yy, r in blobs:
        circ(x + dx, yy, r, "#ffffff", 8)
    for dx, yy, r in blobs:
        circ(x + dx, yy, r, "#d6ecfa", 0)
    for dx, yy, r in blobs:
        circ(x + dx - r * 0.06, yy - r * 0.16, r * 0.86, "#ffffff", 0)


def hill(x, base, a1, a2, phase):
    return (base + a1 * math.sin(2 * math.pi * 3 * x / W + phase)
            + a2 * math.sin(2 * math.pi * 7 * x / W + 2 * phase))


def forest_row(base, a1, a2, phase, spacing, rmin, rmax, fill, edge, seed):
    rnd = random.Random(seed)
    n = int(W // spacing)
    tops = []
    for i in range(n):
        x = i * spacing + rnd.uniform(-spacing * 0.2, spacing * 0.2)
        r = rnd.uniform(rmin, rmax)
        tops.append((x, hill(x, base, a1, a2, phase) - r * 0.4, r))
    ground = " ".join(f"L{x} {hill(x, base, a1, a2, phase) + 20:.1f}" for x in range(0, W + 1, 20))
    for shift in (-W, 0, W):
        add(f'<g transform="translate({shift} 0)">')
        for x, y, r in tops:
            add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}" stroke="{edge}" stroke-width="6"/>')
        add("</g>")
    path(f"M0 {H} {ground} L{W} {H} Z", fill, 0)
    for shift in (-W, 0, W):
        add(f'<g transform="translate({shift} 0)">')
        for x, y, r in tops:
            circ(x, y, r, fill, 0)
        add("</g>")


def layer_l0():
    begin()
    box(0, 0, W, H, "#9fd6f3", 0)
    box(0, 520, W, H, "#b4e0f6", 0)
    box(0, 720, W, H, "#c8e9f8", 0)
    for x, y, s in ((260, 170, 1.1), (900, 300, 0.8), (1500, 140, 1.3), (2180, 260, 0.9),
                    (2760, 120, 1.0), (3350, 280, 1.2), (3800, 190, 0.85)):
        place(cloud, x, y, s, x0=x - 180 * s, x1=x + 180 * s)
    # two rows of distant forest, pale and outlined in a soft teal instead of black ink
    forest_row(820, 30, 14, 0.4, 64, 34, 58, "#a7d4c0", "#7fb5a0", 5)
    forest_row(900, 22, 12, 2.1, 80, 42, 70, "#7fbea5", "#5a9c84", 9)
    end("sgu_bg_L0.svg")


# ============================================================== L2 trees, houses, benches

def story_tree(x, base, s, seed, palette=("#2f7a33", "#45a03f", "#6cc153")):
    trunk = (f"M{x - 34 * s} {base} Q{x - 18 * s} {base - 90 * s} {x - 26 * s} {base - 170 * s} "
             f"Q{x - 34 * s} {base - 230 * s} {x - 12 * s} {base - 280 * s} L{x + 16 * s} {base - 280 * s} "
             f"Q{x + 2 * s} {base - 220 * s} {x + 22 * s} {base - 160 * s} Q{x + 30 * s} {base - 80 * s} {x + 38 * s} {base} "
             f"Q{x} {base + 8} {x - 34 * s} {base} Z")
    path(trunk, C["bark"])
    curve(f"M{x - 4 * s} {base - 20 * s} Q{x + 10 * s} {base - 110 * s} {x - 6 * s} {base - 200 * s}", C["barkdk"], 4)
    curve(f"M{x + 6 * s} {base - 210 * s} Q{x + 40 * s} {base - 250 * s} {x + 70 * s} {base - 300 * s}", C["barkdk"], 4)
    rnd = random.Random(seed)
    blobs = [(-110, -330, 80), (-50, -410, 95), (50, -420, 100), (115, -335, 80), (0, -320, 95),
             (-150, -270, 50), (150, -270, 52), (-60, -270, 70), (65, -270, 70)]
    blobs = [((dx + rnd.uniform(-10, 10)) * s, base + dy * s, r * s * rnd.uniform(0.92, 1.08)) for dx, dy, r in blobs]
    blob_cluster(x, blobs, *palette, seed=seed)
    # a few fruit dots for the storybook feel
    for dx, dy in ((-70, -360), (60, -380), (110, -300), (-120, -290)):
        circ(x + dx * s, base + dy * s, 8 * s, "#ff6b57", 3)


def mushroom_house(x, base, h, cw, cap, spot, door="#7a4a2c"):
    bw = cw * 0.5
    top = base - h
    ch = cw * 0.8
    # chimney first so the cap overlaps its foot
    chx = x + cw * 0.42
    box(chx - 16, top - ch * 1.05, chx + 16, top - ch * 0.4, "#c0603a", 5)
    box(chx - 22, top - ch * 1.05 - 12, chx + 22, top - ch * 1.05, "#9c4a2c", 4, 3)
    for i, (dx, dy) in enumerate(((0, -40), (18, -80), (4, -122))):
        sy = top - ch * 1.05 - 18 + dy
        curve(f"M{chx + dx - 14} {sy + 14} q-6 -16 8 -20 q14 -4 12 -18", "#9a9a9a", 6 - i)
    # house body (the mushroom stem)
    path(f"M{x - bw} {base} Q{x - bw * 0.82} {base - h * 0.55} {x - bw * 0.8} {top} L{x + bw * 0.8} {top} "
         f"Q{x + bw * 0.82} {base - h * 0.55} {x + bw} {base} Q{x} {base + 8} {x - bw} {base} Z", C["stem"])
    curve(f"M{x + bw * 0.62} {top + 24} Q{x + bw * 0.66} {base - h * 0.45} {x + bw * 0.86} {base - 10}", C["gill"], 8)
    # door
    dw, dh = bw * 0.42, h * 0.5
    path(f"M{x - dw} {base - 2} L{x - dw} {base - dh + dw} A{dw} {dw} 0 0 1 {x + dw} {base - dh + dw} L{x + dw} {base - 2} Z",
         door, 5)
    for dx in (-dw * 0.45, 0, dw * 0.45):
        line(x + dx, base - dh + dw * 0.6, x + dx, base - 8, C["wooddk"], 3)
    circ(x + dw * 0.6, base - dh * 0.45, 4, "#e8c060", 2.5)
    box(x - dw - 12, base - 6, x + dw + 12, base + 6, C["stone"], 4, 4)
    # round windows with tiny shutters
    for wx, wy in ((x - bw * 0.6, base - h * 0.62), (x + bw * 0.55, base - h * 0.78)):
        r = bw * 0.2
        box(wx - r * 2.0, wy - r, wx - r * 1.1, wy + r, C["green"], 3.5, 3)
        box(wx + r * 1.1, wy - r, wx + r * 2.0, wy + r, C["green"], 3.5, 3)
        circ(wx, wy, r + 6, C["wood"], 4)
        circ(wx, wy, r, "#ffe7a3", 4)
        line(wx - r, wy, wx + r, wy, C["wood"], 3)
        line(wx, wy - r, wx, wy + r, C["wood"], 3)
    # cap
    add(f'<ellipse cx="{x:.1f}" cy="{top:.1f}" rx="{cw * 0.9:.1f}" ry="{cw * 0.12:.1f}" fill="{C["gill"]}" '
        f'stroke="{INK}" stroke-width="4"/>')
    path(f"M{x - cw} {top} C{x - cw * 1.03} {top - ch * 1.35} {x + cw * 1.03} {top - ch * 1.35} {x + cw} {top} "
         f"Q{x} {top + cw * 0.17} {x - cw} {top} Z", cap)
    for dx, dy, r in ((-0.6, -0.28, 0.14), (-0.15, -0.68, 0.13), (0.15, -0.3, 0.1),
                      (-0.3, -0.1, 0.08), (0.75, -0.14, 0.08)):
        circ(x + dx * cw, top + dy * ch, r * cw, spot, 4)
    add(f'<ellipse cx="{x - cw * 0.5:.1f}" cy="{top - ch * 0.6:.1f}" rx="{cw * 0.08:.1f}" ry="{cw * 0.16:.1f}" '
        f'fill="#ffffff" opacity="0.45" transform="rotate(40 {x - cw * 0.5:.1f} {top - ch * 0.6:.1f})"/>')


def stone_bench(x, base):
    for lx in (x - 70, x + 46):
        box(lx, base - 44, lx + 24, base, "#b8b1a4", 4, 4)
    box(x - 96, base - 60, x + 96, base - 40, "#d2ccc0", 5, 8)
    line(x - 86, base - 54, x + 40, base - 54, "#efebe3", 4)
    box(x - 90, base - 40, x + 90, base - 34, "#a39b8d", 0)


def bush(x, base, s, seed):
    blobs = [(-50, -30, 34), (-10, -50, 42), (40, -36, 36), (70, -20, 24), (-80, -16, 22)]
    blobs = [(dx * s, base + dy * s, r * s) for dx, dy, r in blobs]
    blob_cluster(x, blobs, "#2f7a33", "#4aa543", "#72c75a", ink_w=8, seed=seed)
    rnd = random.Random(seed)
    for _ in range(4):
        circ(x + rnd.uniform(-70, 70) * s, base + rnd.uniform(-60, -15) * s, 6 * s, rnd.choice(["#ff7ab6", "#ffffff", "#ffd23f"]), 2.5)


def layer_l2():
    begin()
    g = 968
    top = wave(950, 7, 320)
    path(top + f" L{W} {H} L0 {H} Z", "#86cc55", 0)
    curve(top, INK, 5)
    curve(wave(966, 5, 320), "#68b23f", 4)

    items = [
        (story_tree, (150, g, 1.05, 1), -40, 340),
        (mushroom_house, (640, g + 4, 230, 175, "#e23b2e", "#ffffff"), 450, 830),
        (fence, (820, 1020, g + 6, 66), 800, 1040),
        (stone_bench, (1160, g + 4), 1060, 1260),
        (story_tree, (1420, g, 0.95, 2, ("#2c6f3a", "#3f9a4f", "#64bd6b")), 1240, 1600),
        (bush, (1610, g + 2, 1.0, 3), 1520, 1700),
        (mushroom_house, (1860, g + 4, 270, 205, "#3a7fd6", "#d9ecff", "#8a5a3b"), 1650, 2070),
        (stone_bench, (2130, g + 4), 2030, 2230),
        (story_tree, (2380, g, 1.12, 4), 2180, 2580),
        (fence, (2560, 2740, g + 6, 66), 2540, 2760),
        (mushroom_house, (2960, g + 4, 220, 165, "#f08a24", "#fff1cf"), 2780, 3140),
        (bush, (3190, g + 2, 0.9, 5), 3100, 3280),
        (stone_bench, (3330, g + 4), 3230, 3430),
        (story_tree, (3620, g, 0.9, 6, ("#2c6f3a", "#3f9a4f", "#64bd6b")), 3450, 3790),
        (mushroom, (1010, g + 10, 95, 46, "#e23b2e", "#ffffff"), 950, 1070),
        (mushroom, (2240, g + 12, 80, 40, "#f08a24", "#fff1cf"), 2190, 2290),
        (mushroom, (3445, g + 10, 90, 44, "#3a7fd6", "#d9ecff"), 3390, 3500),
        (fence, (3780, 3990, g + 6, 66), 3760, 4010),
    ]
    for fn, args, x0, x1 in items:
        place(fn, *args, x0=x0, x1=x1)
    rnd = random.Random(8)
    for _ in range(70):
        x, y = rnd.uniform(0, W), rnd.uniform(975, 1060)
        p = rnd.choice(["#ff7ab6", "#ffffff", "#ffd23f", "#b48cff"])
        place(flower, x, y, rnd.uniform(5, 7), p, "#f5a623", x0=x - 12, x1=x + 12, wobble=False)
    end("sgu_bg_L2.svg")


# ============================================================== L3 running path

def brickiness(x):
    """1 = courtyard bricks, 0 = dirt path; periodic so both edges are bricks."""
    p = 0.5 + 0.5 * math.cos(2 * math.pi * x / W)
    return min(1.0, max(0.0, (p - 0.3) / 0.4))


def layer_l3():
    begin()
    top_y = 952
    path(f"M0 {top_y} L{W} {top_y} L{W} {H} L0 {H} Z", "#d9a86c", 0)
    rnd = random.Random(31)
    # pebbles and ruts in the dirt stretch
    for _ in range(420):
        x, y = rnd.uniform(0, W), rnd.uniform(top_y + 8, H - 4)
        if rnd.random() < brickiness(x) + 0.05:
            continue
        r = rnd.uniform(3, 9)
        col = rnd.choice(["#c08f58", "#b98a55", "#cfc6b6", "#a89f90"])
        for s in ((-W, 0, W) if (x < 15 or x > W - 15) else (0,)):
            add(f'<ellipse cx="{x + s:.1f}" cy="{y:.1f}" rx="{r * 1.4:.1f}" ry="{r:.1f}" fill="{col}" '
                f'stroke="{INK}" stroke-width="{2.5 if r > 5 else 0}"/>')
    for y in (990, 1035):
        curve(wave(y, 4, 480), "#c4925a", 4)
    # brick rows, a little taller toward the viewer
    rows = [(top_y + 4, 26, 60), (top_y + 30, 28, 56), (top_y + 58, 30, 52), (top_y + 88, 32, 48), (top_y + 120, 34, 45)]
    reds = ["#d9663b", "#e57a45", "#c9552f", "#de6e40"]
    for ri, (y, h, n) in enumerate(rows):
        bw = W / n
        off = bw / 2 if ri % 2 else 0
        rr = random.Random(100 + ri)
        for i in range(n):
            x = off + i * bw
            keep = rr.random()
            col = rr.choice(reds)
            if keep > brickiness(x + bw / 2) * 1.1:
                continue
            for s in ((0, -W) if x + bw > W else (0,)):
                bx = x + s
                box(bx + 2, y + 2, bx + bw - 2, y + h - 2, col, 3.5, 4)
                line(bx + 8, y + 7, bx + bw - 10, y + 7, "#f19a6a", 3)
    # grass lip along the top edge with blades hanging over the path
    teeth = " ".join(f"L{x - 8} {top_y + 14 + (6 if ((x - 16) // 16) % 3 == 0 else 0)} L{x - 16} {top_y + 4}"
                     for x in range(W, 0, -16))
    lip = wave(926, 6, 240) + f" L{W} {top_y + 4} {teeth} Z"
    path(lip, "#6fbd47", 0)
    curve(wave(926, 6, 240), INK, 5)
    for x in range(0, W, 16):
        yb = top_y + 14 + (6 if (x // 16) % 3 == 0 else 0)
        curve(f"M{x} {top_y + 4} L{x + 8} {yb} L{x + 16} {top_y + 4}", INK, 3.5)
    curve(wave(940, 4, 240), "#4f9e36", 4)
    for _ in range(90):
        x = rnd.uniform(0, W)
        d = f"M{x - 8:.1f} 930 q2 -14 6 0 q3 -18 6 0 q3 -14 6 0"
        for s in ((-W, 0, W) if (x < 20 or x > W - 20) else (0,)):
            add(f'<path transform="translate({s} 0)" d="{d}" fill="none" stroke="#3f8a2e" stroke-width="3.5" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
    end("sgu_bg_L3.svg")


# ============================================================== L4 foreground

def blade(x, base, tip_y, lean, w, fill):
    my = (base + tip_y) / 2
    path(f"M{x - w} {base} Q{x - w * 0.4 + lean * 0.3} {my} {x + lean} {tip_y} "
         f"Q{x + w * 0.5 + lean * 0.35} {my} {x + w} {base} Z", fill, 4)


def grass_clump(x, seed, n=9, height=220):
    rnd = random.Random(seed)
    cols = ["#3b8530", "#4f9e3c", "#62b347", "#2e6f28"]
    for i in range(n):
        dx = rnd.uniform(-60, 60)
        blade(x + dx, H + 10, H - height * rnd.uniform(0.55, 1.0), dx * 0.9 + rnd.uniform(-50, 50),
              rnd.uniform(9, 15), cols[i % len(cols)])


def daisy(x, head_y, lean, s):
    hx = x + lean
    curve(f"M{x} {H + 5} Q{x + lean * 0.2} {(H + head_y) / 2} {hx} {head_y}", INK, 9)
    curve(f"M{x} {H + 5} Q{x + lean * 0.2} {(H + head_y) / 2} {hx} {head_y}", "#4f9e3c", 5)
    for side in (-1, 1):
        lx, ly = x + lean * 0.12, H - (H - head_y) * 0.3
        path(f"M{lx} {ly} Q{lx + side * 26 * s} {ly - 26 * s} {lx + side * 44 * s} {ly - 8 * s} "
             f"Q{lx + side * 20 * s} {ly + 4 * s} {lx} {ly} Z", "#4f9e3c", 3.5)
    for i in range(12):
        a = i * 30
        add(f'<ellipse cx="{hx:.1f}" cy="{head_y - 17 * s:.1f}" rx="{6 * s:.1f}" ry="{15 * s:.1f}" fill="#ffffff" '
            f'stroke="{INK}" stroke-width="3" transform="rotate({a} {hx:.1f} {head_y:.1f})"/>')
    circ(hx, head_y, 10 * s, "#ffc42e", 3.5)
    circ(hx - 3 * s, head_y - 3 * s, 3.5 * s, "#ffe58a", 0)


def fern(x, height, lean, s, seed):
    rnd = random.Random(seed)
    p0 = (x, H + 5)
    p1 = (x + lean * 0.2, H - height * 1.1)
    p2 = (x + lean, H - height * 0.75)
    curve(f"M{p0[0]} {p0[1]} Q{p1[0]} {p1[1]} {p2[0]} {p2[1]}", INK, 9)
    curve(f"M{p0[0]} {p0[1]} Q{p1[0]} {p1[1]} {p2[0]} {p2[1]}", "#3f8f3a", 5)
    for i in range(1, 14):
        t = 0.15 + i * 0.06
        bx = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        by = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        tx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])
        ty = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
        ang = math.degrees(math.atan2(ty, tx))
        ln = (1.15 - t) * 46 * s
        for side in (-1, 1):
            a = ang + side * 70
            cx = bx + math.cos(math.radians(a)) * ln / 2
            cy = by + math.sin(math.radians(a)) * ln / 2
            add(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{ln / 2:.1f}" ry="{ln / 6 + 2:.1f}" '
                f'fill="{rnd.choice(["#4fa043", "#5db24c"])}" stroke="{INK}" stroke-width="3" '
                f'transform="rotate({a:.1f} {cx:.1f} {cy:.1f})"/>')


def leaf(x, y, rot, s, col):
    d = f"M{x - 22 * s} {y} Q{x} {y - 16 * s} {x + 22 * s} {y} Q{x} {y + 16 * s} {x - 22 * s} {y} Z"
    add(f'<g transform="rotate({rot} {x:.1f} {y:.1f})">')
    path(d, col, 3.5)
    line(x - 18 * s, y, x + 18 * s, y, INK, 2)
    add("</g>")


def layer_l4():
    begin()
    top = wave(1046, 6, 160)
    path(top + f" L{W} {H} L0 {H} Z", "#3f8f3a", 0)
    curve(top, INK, 5)
    rnd = random.Random(44)
    x = 60
    i = 0
    while x < W - 40:
        kind = i % 4
        if kind == 0:
            place(grass_clump, x, 500 + i, rnd.randint(7, 11), rnd.uniform(170, 260), x0=x - 130, x1=x + 130)
        elif kind == 1:
            for j in range(rnd.randint(1, 3)):
                dx = rnd.uniform(-40, 40)
                place(daisy, x + dx, rnd.uniform(860, 960), rnd.uniform(-30, 30), rnd.uniform(0.8, 1.1),
                      x0=x + dx - 80, x1=x + dx + 80)
            place(grass_clump, x + 50, 600 + i, 5, 150, x0=x - 80, x1=x + 180)
        elif kind == 2:
            place(fern, x, rnd.uniform(150, 230), rnd.choice((-1, 1)) * rnd.uniform(90, 150), 1.0, i,
                  x0=x - 220, x1=x + 220)
        else:
            place(grass_clump, x, 700 + i, rnd.randint(5, 8), rnd.uniform(120, 190), x0=x - 130, x1=x + 130)
            place(daisy, x + 70, rnd.uniform(900, 970), rnd.uniform(-20, 20), 0.85, x0=x - 20, x1=x + 160)
        x += rnd.uniform(260, 420)
        i += 1
    for _ in range(26):
        lx, ly = rnd.uniform(40, W - 40), rnd.uniform(830, 1040)
        place(leaf, lx, ly, rnd.uniform(0, 360), rnd.uniform(0.8, 1.2),
              rnd.choice(["#f0a030", "#e8702a", "#c8d840", "#7cc34f"]), x0=lx - 30, x1=lx + 30)
    end("sgu_bg_L4.svg")


if __name__ == "__main__":
    layer_l0()
    layer_l2()
    layer_l3()
    layer_l4()
