"""Sprite sheets for the original "mushroom-cap kid" student character.

Each animation is one row of 256x256 frames, facing right, bottom-centered.
Outputs (in sprites/):
  kid_<anim>[_<variant>].svg   full character, one sheet per animation and variant
  kid_<anim>_cap.svg           the cap alone, aligned to the same frames (blank name label)
  kid_sprites.json             frame counts, fps, name-label placement per frame, motion hints
Run:  python gen_kid_sprites.py
"""
import json
import math
from pathlib import Path

INK = "#2b1d14"
F = 256          # frame size
GROUND = 250     # y of the lowest point of the character in each frame
OUT = Path(__file__).parent / "sprites"

COL = dict(
    skin="#ffd7b5", skin_b="#efbd96", shirt="#fdfbf5", shirt_sh="#e6e0d2", shorts="#2b5fb8",
    shorts_dk="#214a91", cap="#2f74d6", cap_dk="#2459ab", dot="#ffffff", gill="#f0e2bf",
    shoe="#8a5232", shoe_b="#6e3f25", sole="#f3ead8", badge="#1f4e9c", blush="#ff9e9e",
    mouth="#8a2a2a", tongue="#ff7f8a", label="#fff3d6", stitch="#c9a26b",
)

# body measurements (character space: hip at origin, y down, facing +x)
THIGH, SHIN = 20, 20
UPPER, FORE = 18, 17
HIP_F, HIP_B = (4, -2), (-4, -2)
SHOULDER = (2, -36)
NECK = (2, -42)
HEAD_UP = 22                     # neck -> head center
LABEL = dict(cx=-1, cy=-32, w=52, h=20)   # name label in head space

# ---------------------------------------------------------------- math helpers


def rot(p, a):
    r = math.radians(a)
    return (p[0] * math.cos(r) - p[1] * math.sin(r), p[0] * math.sin(r) + p[1] * math.cos(r))


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def limb_dir(a):
    """Unit vector for a limb angle: 0 = straight down, positive = toward facing direction."""
    r = math.radians(a)
    return (math.sin(r), math.cos(r))


def along(p, a, length):
    d = limb_dir(a)
    return (p[0] + d[0] * length, p[1] + d[1] * length)


def f2(v):
    return f"{v:.1f}"


# ---------------------------------------------------------------- svg primitives

class Svg:
    def __init__(self):
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def limb(self, pts, color, w):
        d = "M" + " L".join(f"{f2(x)} {f2(y)}" for x, y in pts)
        self.add(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w + 6}" stroke-linecap="round" stroke-linejoin="round"/>')
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')

    def circle(self, c, r, fill, sw=3, extra=""):
        st = f'stroke="{INK}" stroke-width="{sw}"' if sw else ('' if 'stroke=' in extra else 'stroke="none"')
        self.add(f'<circle cx="{f2(c[0])}" cy="{f2(c[1])}" r="{f2(r)}" fill="{fill}" {st} {extra}/>')

    def ellipse(self, c, rx, ry, fill, sw=3, angle=0, extra=""):
        st = f'stroke="{INK}" stroke-width="{sw}"' if sw else ('' if 'stroke=' in extra else 'stroke="none"')
        tr = f' transform="rotate({f2(angle)} {f2(c[0])} {f2(c[1])})"' if angle else ""
        self.add(f'<ellipse cx="{f2(c[0])}" cy="{f2(c[1])}" rx="{f2(rx)}" ry="{f2(ry)}" fill="{fill}" {st}{tr} {extra}/>')

    def path(self, d, fill, sw=3, extra=""):
        st = f'stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"' if sw else ('' if 'stroke=' in extra else 'stroke="none"')
        self.add(f'<path d="{d}" fill="{fill}" {st} {extra}/>')

    def line(self, a, b, color=INK, w=3):
        self.add(f'<line x1="{f2(a[0])}" y1="{f2(a[1])}" x2="{f2(b[0])}" y2="{f2(b[1])}" stroke="{color}" '
                 f'stroke-width="{w}" stroke-linecap="round"/>')


# ---------------------------------------------------------------- character parts

def draw_leg(s, hip, th, bend, back):
    knee = along(hip, th, THIGH)
    ankle = along(knee, th - bend, SHIN)
    s.limb([hip, knee, ankle], COL["skin_b"] if back else COL["skin"], 10)
    s.circle(ankle, 5.5, COL["shirt"], 2.5)  # sock cuff
    fd = limb_dir(th - bend)
    fwd = (fd[1], -fd[0])  # perpendicular, toward facing side
    c = (ankle[0] + fwd[0] * 6 + fd[0] * 4, ankle[1] + fwd[1] * 6 + fd[1] * 4)
    ang = math.degrees(math.atan2(fwd[1], fwd[0]))
    s.ellipse(c, 12, 7, COL["shoe_b"] if back else COL["shoe"], 3, ang)
    sole_c = (c[0] + fd[0] * 4, c[1] + fd[1] * 4)
    s.ellipse(sole_c, 11, 2.2, COL["sole"], 0, ang)
    return [hip, knee, ankle, c, add(c, (fwd[0] * 12, fwd[1] * 12))]


def draw_arm(s, shoulder, sh_abs, el, back):
    elbow = along(shoulder, sh_abs, UPPER)
    hand = along(elbow, sh_abs + el, FORE)
    s.limb([shoulder, elbow, hand], COL["skin_b"] if back else COL["skin"], 9)
    s.circle(hand, 6.5, COL["skin_b"] if back else COL["skin"], 3)
    return [shoulder, elbow, hand]


def draw_torso(s, pulled=False):
    s.path("M-15 -14 Q-16 6 -10 8 L-2 8 L0 2 L2 8 L12 8 Q17 6 16 -14 Z", COL["shorts"], 3.5)
    s.line((0, 2), (0, -6), COL["shorts_dk"], 2.5)
    s.path("M-14 -12 Q-17 -30 -10 -40 Q2 -46 12 -40 Q18 -30 17 -12 Q2 -8 -14 -12 Z", COL["shirt"], 3.5)
    s.path("M-12 -16 Q-14 -28 -9 -36", "none", 0, f'stroke="{COL["shirt_sh"]}" stroke-width="4" stroke-linecap="round"')
    if pulled:
        # collar yanked up at the back of the neck
        s.path("M-12 -38 L-15 -54 L-4 -44 Z", COL["shirt"], 3)
        s.line((-10, -40), (-13, -48), COL["shirt_sh"], 2)
    s.path("M-6 -42 L2 -34 L10 -42 L6 -45 L2 -40 L-2 -45 Z", COL["shorts"], 2.5)
    s.circle((9, -27), 5, COL["badge"], 2.5)
    s.circle((9, -27), 3, "none", 0, f'stroke="{COL["dot"]}" stroke-width="1.5"')


def draw_backpack(s):
    s.path("M-14 -38 Q-28 -38 -28 -26 L-28 -12 Q-28 -6 -20 -6 L-13 -6 Z", "#e88a2e", 3.5)
    s.path("M-27 -22 L-19 -22 L-19 -12 L-27 -12", "#c96f1c", 2.5)
    s.path("M-12 -39 Q0 -42 6 -36 L4 -32 Q-2 -37 -12 -34 Z", "#c96f1c", 2.5)


def draw_book(s):
    s.path("M6 -38 L22 -36 L20 -12 L4 -14 Z", "#d6453a", 3)
    s.path("M8 -36 L8 -14", "none", 0, f'stroke="#f3e5c8" stroke-width="3"')


def draw_eye(s, c, rx, ry, kind, t):
    x, y = c
    if kind in ("open", "wide"):
        if kind == "wide":
            rx, ry = rx + 1, ry + 1.5
        s.ellipse(c, rx, ry, "#ffffff", 2.5)
        pr = 2.2 if kind == "wide" else 3.2
        s.circle((x + 1.5, y + 0.5), pr, INK, 0)
        s.circle((x + 0.6, y - 1.2), 1.1, "#ffffff", 0)
    elif kind == "happy":
        s.path(f"M{x - rx} {y + 2} Q{x} {y - ry} {x + rx} {y + 2}", "none", 3)
    elif kind == "squish":
        s.path(f"M{x - rx} {y - 4} L{x + rx * 0.6} {y} L{x - rx} {y + 4}", "none", 3)
    elif kind == "strain":
        s.path(f"M{x - rx} {y} Q{x} {y + 3} {x + rx} {y}", "none", 3)
        s.line((x - rx, y - 4), (x + rx, y - 2), INK, 2.5)
    elif kind == "dizzy":
        s.ellipse(c, rx, ry, "#ffffff", 2.5)
        a0 = t * 90
        pts = []
        for i in range(22):
            a = math.radians(a0 + i * 30)
            r = 0.5 + i * 0.22
            pts.append(f"{f2(x + r * math.cos(a))} {f2(y + r * math.sin(a) * 1.2)}")
        s.path("M" + " L".join(pts), "none", 1.8)


MOUTHS = {
    "smile": lambda s: s.path("M6 15 Q13 22 20 15", "none", 3),
    "grin": lambda s: (s.path("M5 13 Q13 28 21 13 Q13 16 5 13 Z", COL["mouth"], 2.5),
                       s.path("M9 20 Q13 24 17 20 Q13 18 9 20 Z", COL["tongue"], 0)),
    "o": lambda s: s.ellipse((14, 18), 3.8, 5, COL["mouth"], 2.5),
    "wavy": lambda s: s.path("M5 18 q2.5 -3 5 0 q2.5 3 5 0 q2.5 -3 5 0", "none", 2.5),
    "grit": lambda s: (s.path("M6 14 L21 14 L20 20 L7 20 Z", "#ffffff", 2.5), s.line((6.5, 17), (20.5, 17), INK, 1.5)),
    "flat": lambda s: s.line((7, 17), (19, 16), INK, 3),
}

FACES = {  # near eye, far eye, mouth
    "happy": ("open", "open", "grin"),
    "panic_happy": ("wide", "wide", "grin"),
    "panic": ("wide", "wide", "o"),
    "surprised": ("wide", "wide", "o"),
    "squish": ("squish", "squish", "flat"),
    "dizzy": ("dizzy", "dizzy", "wavy"),
    "strain": ("strain", "strain", "grit"),
    "relief": ("happy", "happy", "smile"),
    "determined": ("open", "open", "smile"),
}

CAP_DOME = "M-47 -15 C-50 -66 46 -74 43 -15 Q-2 -6 -47 -15 Z"


def draw_cap(s, label=True):
    s.ellipse((-2, -15), 45, 8, COL["gill"], 3)
    s.path(CAP_DOME, COL["cap"], 3.5)
    s.add('<g clip-path="url(#capclip)">')
    s.path("M20 -60 Q46 -40 43 -15 L60 -15 L60 -70 Z", COL["cap_dk"], 0)
    for x, y, r in ((-38, -25, 5.5), (-20, -50, 5), (8, -53, 4.5), (33, -38, 5.5), (37, -21, 3.5), (-44, -40, 3.5)):
        s.circle((x, y), r, COL["dot"], 2.5)
    s.add("</g>")
    if label:
        L = LABEL
        x0, y0 = L["cx"] - L["w"] / 2, L["cy"] - L["h"] / 2
        s.add(f'<rect x="{x0}" y="{y0}" width="{L["w"]}" height="{L["h"]}" rx="4" fill="{COL["label"]}" '
              f'stroke="{INK}" stroke-width="2.5"/>')
        s.add(f'<rect x="{x0 + 3}" y="{y0 + 3}" width="{L["w"] - 6}" height="{L["h"] - 6}" rx="2" fill="none" '
              f'stroke="{COL["stitch"]}" stroke-width="1.5" stroke-dasharray="3 2"/>')


def draw_head(s, face, t, variant):
    s.circle((-16, 4), 6, COL["skin"], 3)          # ear
    if variant == "pencil":
        s.add('<g transform="rotate(-28 -18 -6)">')
        s.path("M-36 -10 L-6 -10 L-6 -3 L-36 -3 Z", "#ffcf3a", 2.5)
        s.path("M-6 -10 L2 -6.5 L-6 -3 Z", "#f3d2a2", 2.5)
        s.path("M-36 -10 L-41 -10 Q-43 -6.5 -41 -3 L-36 -3 Z", "#ff8fa3", 2.5)
        s.add("</g>")
    s.circle((0, 0), 27, COL["skin"], 3.5)
    s.ellipse((-3, 14), 5, 3, COL["blush"], 0, extra='opacity="0.75"')
    ne, fe, mo = FACES[face]
    draw_eye(s, (3, 4), 5.5, 7.5, ne, t)
    draw_eye(s, (16, 3), 4.5, 7, fe, t)
    MOUTHS[mo](s)
    s.circle((25, 11), 5.5, COL["skin"], 3)          # nose
    s.circle((24, 9), 1.6, "#ffffff", 0)
    if variant == "glasses":
        for c, r in (((3, 4), 9), ((16.5, 3), 7.5)):
            s.circle(c, r, "#cfe9ff", 0, 'opacity="0.35"')
            s.circle(c, r, "none", 0, 'stroke="#1d2a5c" stroke-width="3.5"')
        s.line((12, 3), (9, 3), "#1d2a5c", 3.5)
        s.line((-6, 3), (-15, 1), "#1d2a5c", 3.5)
    draw_cap(s)


# ---------------------------------------------------------------- pose -> frame

def pose_points(p):
    """Character-space key points with padding, used for grounding and bounds."""
    lean = p.get("lean", 0)
    pts = []
    for hip, (th, bend) in ((HIP_F, p["legF"]), (HIP_B, p["legB"])):
        knee = along(hip, th, THIGH)
        ankle = along(knee, th - bend, SHIN)
        fd = limb_dir(th - bend)
        fwd = (fd[1], -fd[0])
        for k in (-6, 6, 16):
            pts.append((add(ankle, (fwd[0] * k + fd[0] * 9, fwd[1] * k + fd[1] * 9)), 2))
        pts.append((knee, 8))
    sh = rot(SHOULDER, lean)
    for sh_rel, el in (p["armF"], p["armB"]):
        e = along(sh, sh_rel - lean, UPPER)
        h = along(e, sh_rel - lean + el, FORE)
        pts += [(e, 7), (h, 9)]
    neck = rot(NECK, lean)
    ha = lean + p.get("head", 0)
    hc = add(neck, rot((0, -HEAD_UP), ha))
    pts.append((hc, 29))
    for x, y in ((-49, -15), (45, -15), (-30, -50), (0, -56), (28, -50), (-2, -8)):
        pts.append((add(hc, rot((x, y), ha)), 3))
    for x, y in ((-16, 8), (16, 8), (-17, -30), (17, -30)):
        pts.append((rot((x, y), lean), 3))
    return pts, hc, ha


def place_pose(p):
    pts, hc, ha = pose_points(p)
    r = p.get("rot", 0)
    world = [(rot(q, r), pad) for q, pad in pts]
    lowest = max(q[1] + pad for q, pad in world)
    hx = p.get("x", 118)
    hy = GROUND - p.get("lift", 0) - lowest
    minx = min(q[0] - pad for q, pad in world) + hx
    maxx = max(q[0] + pad for q, pad in world) + hx
    top = min(q[1] - pad for q, pad in world) + hy
    if minx < 4:
        hx += 4 - minx
    elif maxx > F - 4:
        hx -= maxx - (F - 4)
    if top < 2:
        print(f"  warning: frame top at {top:.0f}")
    return hx, hy, r, hc, ha


def draw_character(s, p, t, variant, cap_only=False):
    lean = p.get("lean", 0)
    sh = rot(SHOULDER, lean)
    sh_b = add(sh, rot((-3, 1), lean))
    neck = rot(NECK, lean)
    ha = lean + p.get("head", 0)
    hc = add(neck, rot((0, -HEAD_UP), ha))
    armF = (15, 85) if variant == "book" else p["armF"]
    if cap_only:
        s.add(f'<g transform="translate({f2(hc[0])} {f2(hc[1])}) rotate({f2(ha)})">')
        draw_cap(s)
        s.add("</g>")
        return
    draw_arm(s, sh_b, p["armB"][0] - lean, p["armB"][1], True)
    draw_leg(s, HIP_B, *p["legB"], True)
    draw_leg(s, HIP_F, *p["legF"], False)
    s.add(f'<g transform="rotate({f2(lean)})">')
    draw_torso(s, pulled=p.get("pulled", False))
    if variant == "backpack":
        draw_backpack(s)
    if variant == "book":
        draw_book(s)
    s.add("</g>")
    s.add(f'<g transform="translate({f2(hc[0])} {f2(hc[1])}) rotate({f2(ha)})">')
    draw_head(s, p["face"], t, variant)
    s.add("</g>")
    draw_arm(s, sh, armF[0] - lean, armF[1], False)


# ---------------------------------------------------------------- effects (frame space)

def star(s, c, r, a):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        ang = math.radians(a + i * 36 - 90)
        pts.append(f"{f2(c[0] + rr * math.cos(ang))} {f2(c[1] + rr * math.sin(ang))}")
    s.path("M" + " L".join(pts) + " Z", "#ffd23f", 2.5)


def puff(s, c, r):
    s.circle(c, r, "#efe3c8", 2.5)
    s.circle((c[0] - r * 0.25, c[1] - r * 0.25), r * 0.45, "#ffffff", 0)


def effects(s, fx, head_w, t):
    for e in fx:
        kind = e[0]
        if kind == "stars":
            cx, cy = head_w[0], head_w[1] - 34
            for k in range(3):
                a = math.radians(e[1] + k * 120)
                star(s, (cx + 32 * math.cos(a), cy + 10 * math.sin(a)), 7 + 2 * math.sin(a), e[1] + k * 40)
        elif kind == "dust":
            x, n, r = e[1], e[2], e[3]
            for k in range(n):
                puff(s, (x + (k - (n - 1) / 2) * r * 1.5, GROUND - r * (0.8 + 0.3 * (k % 2))), r * (0.8 + 0.25 * (k % 2)))
        elif kind == "sweat":
            x, y = head_w[0] + e[1], head_w[1] + e[2]
            s.path(f"M{f2(x)} {f2(y - 9)} Q{f2(x + 6)} {f2(y + 1)} {f2(x)} {f2(y + 4)} Q{f2(x - 6)} {f2(y + 1)} {f2(x)} {f2(y - 9)} Z",
                   "#9fd8ff", 2.5)
        elif kind == "impact":
            x, y = e[1], e[2]
            for a in (-150, -120, -90, -60, -30):
                d = (math.cos(math.radians(a)), math.sin(math.radians(a)))
                s.line((x + d[0] * 14, y + d[1] * 14), (x + d[0] * 26, y + d[1] * 26), INK, 3.5)
        elif kind == "burst":
            x = e[1]
            for dx in (-22, -8, 8, 22):
                s.line((x + dx, GROUND - 4), (x + dx * 1.3, GROUND - 26 + abs(dx) * 0.4), INK, 3.5)
        elif kind == "kick":
            x, y = e[1], e[2]
            for k in range(3):
                s.path(f"M{x - 10} {y + k * 8} q6 -4 12 0", "none", 3)
        elif kind == "speed":
            for k, y in enumerate((150, 175, 200)):
                s.line((14 + k * 6, y), (40 + k * 6, y), "#b7a58a", 3)


# ---------------------------------------------------------------- animations

def run_frames():
    out = []
    for i in range(8):
        ph = 2 * math.pi * i / 8
        def leg(p):
            return (22 + 52 * math.sin(p), 18 + 80 * max(0.0, math.cos(p)))
        out.append(dict(
            lean=20, head=-8, face="panic_happy",
            legF=leg(ph), legB=leg(ph + math.pi),
            armF=(15 + 70 * math.sin(ph + math.pi), 50), armB=(15 + 70 * math.sin(ph), 45),
            lift=5 * abs(math.sin(ph)),
            fx=[("sweat", -30, -24)] if i % 4 < 2 else [],
        ))
    return out


TRIP = [
    dict(x=124, lean=35, head=-10, face="surprised", legF=(-30, 30), legB=(60, 80), armF=(120, 20), armB=(100, 30)),
    dict(x=112, rot=40, lean=20, head=-15, face="surprised", legF=(-40, 10), legB=(-10, 60), armF=(150, 0), armB=(140, 10), lift=24),
    dict(x=96, rot=68, lean=10, head=-10, face="squish", legF=(-30, 20), legB=(-10, 40), armF=(170, 0), armB=(160, 0), lift=14),
    dict(x=84, rot=90, face="squish", legF=(-10, 0), legB=(-20, 10), armF=(178, 0), armB=(172, 0),
         fx=[("dust", 210, 3, 9), ("impact", 222, 238)]),
    dict(x=84, rot=90, face="dizzy", legF=(-35, 80), legB=(-25, 60), armF=(175, 0), armB=(168, 0), fx=[("stars", 0)]),
    dict(x=84, rot=90, face="dizzy", legF=(-30, 55), legB=(-20, 85), armF=(175, 0), armB=(168, 0), fx=[("stars", 60)]),
]

GETUP = [
    dict(x=92, rot=55, head=-30, face="strain", legF=(-40, 0), legB=(-46, 10), armF=(55, 0), armB=(60, 5)),
    dict(x=104, rot=8, lean=10, face="strain", legF=(85, 90), legB=(-20, 100), armF=(60, 30), armB=(35, 25),
         fx=[("dust", 140, 2, 6)]),
    dict(x=114, lean=24, face="determined", legF=(30, 50), legB=(-15, 30), armF=(-20, 40), armB=(25, 40)),
    dict(x=118, lean=12, face="determined", legF=(15, 15), legB=(-10, 10), armF=(-10, 95), armB=(30, 50)),
]

JUMP = [
    dict(lean=30, face="determined", legF=(55, 105), legB=(30, 100), armF=(-50, 20), armB=(-40, 20), dy=0),
    dict(lean=15, face="happy", legF=(10, 10), legB=(-30, 20), armF=(150, 20), armB=(130, 20), dy=-40,
         fx=[("dust", 110, 2, 6)]),
    dict(lean=10, face="happy", legF=(80, 120), legB=(40, 120), armF=(115, 30), armB=(70, 30), dy=-80),
    dict(lean=5, face="surprised", legF=(40, 20), legB=(10, 30), armF=(160, 10), armB=(140, 20), dy=-40),
    dict(lean=25, face="happy", legF=(55, 100), legB=(25, 90), armF=(40, 30), armB=(60, 30), dy=0,
         fx=[("dust", 120, 3, 7)]),
]

STRUGGLE = [
    dict(lean=-5, head=10, face="panic", pulled=True, legF=(30, 40), legB=(-20, 10), armF=(170, -10), armB=(110, 10),
         fx=[("sweat", 30, -26), ("kick", 150, 214)]),
    dict(rot=-5, head=-5, face="panic", pulled=True, legF=(-10, 10), legB=(40, 60), armF=(100, 10), armB=(165, -5),
         fx=[("kick", 80, 214)]),
    dict(rot=5, face="strain", pulled=True, legF=(45, 80), legB=(0, 20), armF=(160, 0), armB=(120, 20),
         fx=[("sweat", 32, -20), ("kick", 156, 210)]),
    dict(rot=-3, face="panic", pulled=True, legF=(0, 30), legB=(30, 70), armF=(120, 10), armB=(170, 0),
         fx=[("kick", 84, 216)]),
]

POP = [
    dict(face="surprised", legF=(5, 0), legB=(-5, 0), armF=(175, 0), armB=(170, 0), dy=-60, fx=[("burst", 120)]),
    dict(rot=150, lean=20, face="surprised", legF=(80, 130), legB=(70, 130), armF=(60, 90), armB=(50, 90), dy=-110),
    dict(rot=-30, lean=10, face="surprised", legF=(40, 30), legB=(-10, 20), armF=(140, 10), armB=(100, 20), dy=-60),
    dict(lean=25, face="squish", legF=(55, 100), legB=(25, 90), armF=(100, 20), armB=(60, 30), dy=0,
         fx=[("dust", 118, 4, 9)]),
    dict(lean=15, face="relief", legF=(10, 10), legB=(-5, 5), armF=(25, 0), armB=(-30, 40), dy=0,
         fx=[("dust", 96, 2, 5)]),
]

ANIMS = {
    "run": (run_frames(), 14, True),
    "trip": (TRIP, 10, False),
    "getup": (GETUP, 8, False),
    "jump": (JUMP, 10, False),
    "struggle": (STRUGGLE, 10, True),
    "pop": (POP, 10, False),
}
VARIANTS = ["base", "glasses", "backpack", "book", "pencil"]


def defs():
    return ('<defs><clipPath id="capclip" clipPathUnits="userSpaceOnUse">'
            f'<path d="{CAP_DOME}"/></clipPath>'
            '<filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">'
            '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/>'
            '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>'
            '</filter></defs>')


def sheet(frames, variant, cap_only=False):
    s = Svg()
    n = len(frames)
    s.add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{F * n}" height="{F}" viewBox="0 0 {F * n} {F}">')
    s.add(defs())
    meta = []
    for i, p in enumerate(frames):
        hx, hy, r, hc, ha = place_pose(p)
        s.add(f'<g transform="translate({i * F} 0)"><g filter="url(#wobble)">')
        s.add(f'<g transform="translate({f2(hx)} {f2(hy)}) rotate({f2(r)})">')
        draw_character(s, p, i, variant, cap_only)
        s.add("</g>")
        head_w = add((hx, hy), rot(hc, r))
        if not cap_only:
            effects(s, p.get("fx", []), head_w, i)
        s.add("</g></g>")
        lab = add(head_w, rot((LABEL["cx"], LABEL["cy"]), r + ha))
        m = dict(label=dict(x=round(lab[0], 1), y=round(lab[1], 1), angle=round((r + ha + 180) % 360 - 180, 1),
                            w=LABEL["w"], h=LABEL["h"]))
        if "dy" in p:
            m["dy"] = p["dy"]
        if p.get("pulled"):
            grip = add((hx, hy), rot(rot((-14, -52), p.get("lean", 0)), r))
            m["grip"] = dict(x=round(grip[0], 1), y=round(grip[1], 1))
        meta.append(m)
    s.add("</svg>")
    return "\n".join(s.parts), meta


def main():
    OUT.mkdir(exist_ok=True)
    manifest = dict(frame=F, groundY=GROUND, facing="right", variants=VARIANTS,
                    note="label: centre/angle of the blank name patch on the cap, in frame pixels; "
                         "dy: suggested vertical offset for arcs; grip: where a hand holds the collar",
                    anims={})
    for name, (frames, fps, loop) in ANIMS.items():
        print(name)
        meta = None
        for v in VARIANTS:
            svg, meta = sheet(frames, v)
            fn = f"kid_{name}.svg" if v == "base" else f"kid_{name}_{v}.svg"
            (OUT / fn).write_text(svg, encoding="utf-8")
        svg, _ = sheet(frames, "base", cap_only=True)
        (OUT / f"kid_{name}_cap.svg").write_text(svg, encoding="utf-8")
        manifest["anims"][name] = dict(frames=len(frames), fps=fps, loop=loop, frameData=meta)
    (OUT / "kid_sprites.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
