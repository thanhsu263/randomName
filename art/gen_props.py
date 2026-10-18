"""Sack animations, obstacles, UI pieces and effects, each frame on a 512x512 canvas.

Ground objects sit on y=500 at the same pixel scale as the kid and wizard sprites, so they can be
drawn 1:1 next to them. Animated assets are one row of 512px frames.
Outputs (in sprites/): sack_*.svg, obj_*.svg, ui_*.svg, fx_*.svg and props.json
"""
import json
import math
import random

from gen_kid_sprites import INK, OUT, Svg, f2

F = 512
GROUND = 500
CX = F / 2

C = dict(
    sack="#c49563", sack_dk="#a27648", sack_lt="#dcb07c", sack_in="#3a2a1a", rope="#8a6a3a", rope_lt="#b08a52",
    bark="#8d5b3b", bark_dk="#6a4129", soil="#7a5636", soil_dk="#5e412a", moss="#6fae3c", moss_dk="#4f8a2a",
    rock="#a3a7ab", rock_lt="#c4c8cb", rock_dk="#7f848a", wood="#c58b4e", wood_dk="#9c6a36", wood_lt="#dda56a",
    metal="#8e979e", metal_lt="#b9c1c7", mud="#8a6a4a", mud_dk="#6e5238", water="#9fd3e8", paper="#f3e2b3",
    paper_dk="#d9bf86", paper_edge="#c9a76a", fill="#6cc04a", fill_dk="#4f9e36", fill_lt="#9ddc6f",
    star="#ffd23f", star_or="#ff9f2e", dust="#efe3c8", cap="#e23b2e", stem="#f7ecd2", gill="#e7d6ab",
)


def wobble_defs(scale=3.5, freq=0.025):
    return ('<defs><filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{freq}" numOctaves="2" seed="9" result="n"/>'
            f'<feDisplacementMap in="SourceGraphic" in2="n" scale="{scale}" xChannelSelector="R" yChannelSelector="G"/>'
            '</filter></defs>')


def sheet(frames, wobble=True):
    """frames: list of callables fn(s) drawing in a 512x512 frame."""
    s = Svg()
    n = len(frames)
    s.add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{F * n}" height="{F}" viewBox="0 0 {F * n} {F}">')
    s.add(wobble_defs())
    for i, fn in enumerate(frames):
        s.add(f'<g transform="translate({i * F} 0)">' + ('<g filter="url(#wobble)">' if wobble else "<g>"))
        fn(s)
        s.add("</g></g>")
    s.add("</svg>")
    return "\n".join(s.parts)


def stroke_only(s, d, color=INK, w=4.5):
    s.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def tuft(s, x, y, k=1.0, col="#5ea43a"):
    stroke_only(s, f"M{x - 10 * k} {y} q3 -16 7 0 q4 -22 8 0 q4 -16 7 0", col, 4)


# ============================================================== sack

def sack_body(sq=1.0, lean=0.0):
    """Closed, sitting sack. sq < 1 squashes, lean shifts the top sideways."""
    h = 160 * sq
    t = lean
    return (f"M-88 -8 C-104 {-h * 0.55} {-62 + t} {-h * 0.95} {-24 + t} {-h} L{24 + t} {-h} "
            f"C{62 + t} {-h * 0.95} 104 {-h * 0.55} 88 -8 Q0 10 -88 -8 Z"), h


def sack_texture(s, h, t):
    for x, y in ((-50, -60), (-20, -100), (30, -50), (55, -95), (-60, -30), (10, -130)):
        y = y * h / 160
        xx = x + t * (-y / h)
        stroke_only(s, f"M{xx - 7} {y} l14 0 M{xx} {y - 7} l0 14", C["sack_dk"], 2.5)
    s.add(f'<rect x="20" y="{-h * 0.42}" width="34" height="28" rx="3" fill="{C["sack_dk"]}" stroke="{INK}" '
          f'stroke-width="3.5" transform="rotate(10 37 {-h * 0.42 + 14})"/>')
    stroke_only(s, f"M24 {-h * 0.42 + 4} l26 4 M22 {-h * 0.42 + 24} l26 4", C["sack_lt"], 2)
    stroke_only(s, f"M-62 -20 Q-78 {-h * 0.5} {-40 + t * 0.6} {-h * 0.85}", C["sack_dk"], 7)


def sack_neck(s, h, t, opened=0.0):
    """Gathered neck with rope; opened 0..1 spreads the ruffle and shows the dark mouth."""
    top = -h
    if opened <= 0:
        s.path(f"M{-24 + t} {top + 4} Q{-18 + t} {top - 20} {-34 + t} {top - 42} L{34 + t} {top - 42} "
               f"Q{18 + t} {top - 20} {24 + t} {top + 4} Z", C["sack"], 4.5)
        for dx in (-20, -6, 8, 22):
            stroke_only(s, f"M{dx + t} {top - 40} L{dx * 0.5 + t} {top - 16}", C["sack_dk"], 3)
        s.ellipse((t, top - 12), 24, 8, C["rope"], 4)
        stroke_only(s, f"M{18 + t} {top - 10} Q{44 + t} {top + 4} {40 + t} {top + 34}", INK, 9)
        stroke_only(s, f"M{18 + t} {top - 10} Q{44 + t} {top + 4} {40 + t} {top + 34}", C["rope_lt"], 4.5)
        stroke_only(s, f"M{14 + t} {top - 8} Q{30 + t} {top + 18} {18 + t} {top + 40}", INK, 9)
        stroke_only(s, f"M{14 + t} {top - 8} Q{30 + t} {top + 18} {18 + t} {top + 40}", C["rope_lt"], 4.5)
        return
    w = 34 + 40 * opened
    s.path(f"M{-26 - 20 * opened + t} {top + 6} Q{-30 - 10 * opened + t} {top - 16} {-w + t} {top - 34 + 8 * opened} "
           f"L{w + t} {top - 34 + 8 * opened} Q{30 + 10 * opened + t} {top - 16} {26 + 20 * opened + t} {top + 6} Z",
           C["sack"], 4.5)
    s.ellipse((t, top - 34 + 8 * opened), w, 8 + 14 * opened, C["sack_in"], 4)
    s.ellipse((t, top - 34 + 8 * opened), w, 8 + 14 * opened, "none", 0,
              extra=f'stroke="{C["sack_lt"]}" stroke-width="3"')


def bump(s, kind, x, y, ang, k=1.0):
    """A figure pushing from inside: a little cap, fist or foot shape poking out of the sack outline."""
    s.add(f'<g transform="translate({f2(x)} {f2(y)}) rotate({f2(ang)}) scale({k * 1.5})">')
    if kind == "cap":
        d = "M-30 8 C-34 -34 34 -34 30 8"
    elif kind == "fist":
        d = "M-18 8 C-24 -24 24 -24 18 8"
    else:  # foot
        d = "M-24 8 C-26 -18 30 -26 30 0 L28 8"
    s.path(d + " Z", C["sack"], 0)
    stroke_only(s, d, INK, 4.5)
    if kind == "fist":
        stroke_only(s, "M-8 -12 l0 6 M2 -14 l0 6 M11 -11 l0 6", C["sack_dk"], 2.5)
    elif kind == "cap":
        stroke_only(s, "M-20 -4 Q-14 -20 0 -24", C["sack_lt"], 4)
        stroke_only(s, "M-22 8 Q0 2 22 8", C["sack_dk"], 3)
    stroke_only(s, "M-34 14 L-22 4 M34 14 L22 4 M0 22 L0 10", C["sack_dk"], 3)
    s.add("</g>")


def wiggle_marks(s, pts):
    for x, y, a in pts:
        s.add(f'<g transform="translate({x} {y}) rotate({a})">')
        stroke_only(s, "M0 0 q8 -6 16 0 M4 12 q8 -6 16 0", INK, 3.5)
        s.add("</g>")


def sack_frame(tilt=0.0, sq=1.0, lean=0.0, bumps=(), marks=(), opened=0.0, slump=0.0, dust=False):
    def fn(s):
        s.add(f'<g transform="translate({CX} {GROUND}) rotate({tilt}) scale({1 + slump * 0.25} {1 - slump * 0.45})">')
        s.ellipse((0, 0), 96, 12, "#000000", 0, extra='opacity="0.12"')
        d, h = sack_body(sq, lean)
        s.path(d, C["sack"], 5)
        sack_texture(s, h, lean)
        for kind, a, k in bumps:
            r = math.radians(a)
            ex, ey = 90 * math.cos(r) + lean * 0.5, -h * 0.5 + h * 0.48 * math.sin(r)
            bump(s, kind, ex, ey, a + 90, k)
        sack_neck(s, h, lean, opened)
        s.add("</g>")
        wiggle_marks(s, marks)
        if dust:
            for x, r in ((150, 16), (175, 22), (340, 20), (365, 15)):
                s.circle((x, GROUND - r * 0.8), r, C["dust"], 3.5)
    return fn


SACK = {
    "sack_idle": [sack_frame()],
    "sack_wriggle": [
        sack_frame(tilt=-3, lean=-6, bumps=[("cap", -130, 1.0)], marks=[(130, 300, -30)]),
        sack_frame(tilt=4, lean=8, bumps=[("fist", -20, 1.0)], marks=[(372, 330, 30)]),
        sack_frame(tilt=-6, sq=0.94, lean=-10, bumps=[("cap", -50, 0.9), ("foot", 150, 1.0)], marks=[(126, 360, -20)]),
        sack_frame(tilt=7, lean=12, bumps=[("cap", -95, 1.1)], marks=[(150, 310, -40), (360, 300, 40)]),
        sack_frame(tilt=-4, sq=1.04, bumps=[("fist", -165, 1.0), ("foot", 30, 0.9)], marks=[(380, 340, 25)]),
        sack_frame(tilt=2, sq=0.88, lean=4, bumps=[("cap", -110, 0.9), ("fist", -30, 0.9)],
                   marks=[(130, 330, -25), (372, 320, 25)]),
    ],
    "sack_open": [
        sack_frame(tilt=-2, sq=1.02, bumps=[("cap", -90, 1.0)], marks=[(150, 300, -30)]),
        sack_frame(opened=0.35, sq=0.98),
        sack_frame(opened=0.8, sq=0.9, slump=0.2),
        sack_frame(opened=1.0, sq=0.8, slump=0.5, dust=True),
    ],
}


# ============================================================== obstacles

def obj_root(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.path("M-170 6 Q-150 -26 -110 -22 Q-90 -4 -84 6 Z", C["soil"], 4)
    s.path("M86 6 Q100 -24 140 -20 Q168 -6 176 6 Z", C["soil"], 4)
    main = "M-130 -6 C-120 -90 -60 -140 0 -128 C60 -116 96 -60 120 -6"
    stroke_only(s, main, INK, 44)
    stroke_only(s, main, C["bark"], 34)
    second = "M-110 -10 C-96 -70 -40 -150 20 -112 C70 -84 70 -50 104 -10"
    stroke_only(s, second, INK, 26)
    stroke_only(s, second, C["bark_dk"], 17)
    stroke_only(s, "M-70 -96 Q-40 -120 -6 -118 M30 -110 Q62 -96 80 -66", C["bark_dk"], 4)
    stroke_only(s, "M-118 -40 q-24 -8 -34 -30 M110 -40 q22 -2 36 -24", INK, 9)
    stroke_only(s, "M-118 -40 q-24 -8 -34 -30 M110 -40 q22 -2 36 -24", C["bark"], 5)
    for x, y, r in ((-20, -132, 12), (8, -134, 9), (-38, -126, 8)):
        s.circle((x, y), r, C["moss"], 3)
    for x in (-160, -60, 150):
        tuft(s, x, 4)
    s.add("</g>")


def obj_rock(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.ellipse((0, 4), 96, 10, "#000000", 0, extra='opacity="0.12"')
    s.path("M-92 4 Q-104 -56 -60 -92 Q-10 -122 44 -104 Q96 -84 96 -30 Q98 0 86 4 Z", C["rock"], 5)
    s.path("M-60 -84 Q-20 -110 30 -100 Q-6 -90 -30 -70 Q-50 -60 -60 -84 Z", C["rock_lt"], 0)
    s.path("M60 -80 Q90 -50 84 0 L60 0 Q74 -40 60 -80 Z", C["rock_dk"], 0)
    stroke_only(s, "M-20 -40 L4 -60 L30 -52 M-60 -20 L-40 -34", C["rock_dk"], 3.5)
    s.path("M-70 -88 Q-20 -126 40 -106 Q70 -94 76 -76 Q60 -84 50 -70 Q44 -54 34 -68 Q10 -84 -6 -70 "
           "Q-16 -50 -24 -72 Q-46 -80 -56 -64 Q-64 -50 -70 -66 Z", C["moss"], 4)
    s.path("M-50 -96 Q-10 -114 30 -104", "none", 0, f'stroke="{C["moss_dk"]}" stroke-width="4" stroke-linecap="round"')
    for x, y, r in ((-100, -2, 9), (110, -2, 7), (-118, 0, 5)):
        s.circle((x, y), r, C["rock_lt"], 3)
    tuft(s, -80, 4)
    tuft(s, 70, 4)
    s.add("</g>")


def obj_mushroom(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.ellipse((0, 2), 50, 7, "#000000", 0, extra='opacity="0.12"')
    s.path("M-20 0 Q-16 -30 -16 -56 L16 -56 Q16 -30 20 0 Q0 6 -20 0 Z", C["stem"], 4.5)
    stroke_only(s, "M10 -50 Q12 -28 14 -6", C["gill"], 6)
    s.ellipse((0, -56), 46, 8, C["gill"], 4)
    s.path("M-54 -56 C-56 -116 56 -116 54 -56 Q0 -46 -54 -56 Z", C["cap"], 5)
    for x, y, r in ((-30, -72, 9), (0, -92, 8), (28, -74, 10), (-8, -64, 5), (44, -60, 4)):
        s.circle((x, y), r, "#ffffff", 3)
    s.ellipse((-28, -90), 5, 9, "#ffffff", 0, angle=40, extra='opacity="0.45"')
    tuft(s, -34, 2, 0.8)
    tuft(s, 36, 2, 0.8)
    s.add("</g>")


def obj_puddle(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.path("M-118 -12 Q-126 -30 -80 -34 Q-30 -46 30 -38 Q100 -40 116 -20 Q124 -4 90 0 Q0 8 -90 2 Q-122 0 -118 -12 Z",
           C["mud"], 5)
    s.path("M-96 -16 Q-90 -28 -50 -30 Q0 -38 50 -30 Q96 -30 98 -16 Q60 -8 0 -8 Q-70 -6 -96 -16 Z", C["mud_dk"], 0)
    s.ellipse((-30, -20), 30, 5, C["water"], 0, extra='opacity="0.85"')
    s.ellipse((40, -24), 18, 3.5, C["water"], 0, extra='opacity="0.85"')
    s.ellipse((10, -16), 46, 9, "none", 0, extra=f'stroke="{C["water"]}" stroke-width="2.5" opacity="0.7"')
    for x, y, r in ((-134, -20, 6), (130, -30, 5), (-110, -42, 4), (100, -46, 4)):
        s.circle((x, y), r, C["mud"], 3)
    s.add("</g>")


def obj_bucket(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.path("M30 -6 Q90 -12 120 -2 Q90 6 30 4 Z", C["water"], 3)
    s.add('<g transform="translate(-10 -54) rotate(-12)">')
    s.path("M-70 -46 L50 -56 Q62 0 50 56 L-70 46 Q-80 0 -70 -46 Z", C["wood"], 5)
    for y in (-28, -8, 12, 32):
        stroke_only(s, f"M-72 {y * 0.95} L54 {y * 1.12}", C["wood_dk"], 3)
    for x in (-40, 20):
        s.path(f"M{x - 7} {-50 - x * 0.08} L{x + 7} {-51 - x * 0.08} Q{x + 12} 0 {x + 7} {51 + x * 0.08} "
               f"L{x - 7} {50 + x * 0.08} Q{x - 2} 0 {x - 7} {-50 - x * 0.08} Z", C["metal"], 3.5)
        stroke_only(s, f"M{x - 2} {-44} Q{x + 3} 0 {x - 2} {44}", C["metal_lt"], 2.5)
    s.ellipse((52, 0), 14, 56, C["wood_dk"], 5)
    s.ellipse((54, 0), 8, 46, "#3a2a1a", 0)
    stroke_only(s, "M-60 -40 Q-90 -70 -60 -86", INK, 8)
    stroke_only(s, "M-60 -40 Q-90 -70 -60 -86", C["metal_lt"], 3.5)
    s.add("</g>")
    tuft(s, -100, 2)
    s.add("</g>")


def obj_post(s):
    s.add(f'<g transform="translate({CX} {GROUND})">')
    s.ellipse((0, 4), 140, 9, "#000000", 0, extra='opacity="0.12"')
    s.add('<g transform="rotate(-6)">')
    s.path("M-130 -46 L96 -46 L118 -36 L130 -24 L114 -14 L126 -4 L96 0 L-130 0 Q-138 -23 -130 -46 Z", C["wood"], 5)
    s.ellipse((-130, -23), 10, 23, C["wood_lt"], 4.5)
    for r in (6, 13):
        s.ellipse((-130, -23), r * 0.45, r, "none", 0, extra=f'stroke="{C["wood_dk"]}" stroke-width="2.5"')
    stroke_only(s, "M-110 -34 Q-40 -38 30 -32 Q70 -30 100 -36 M-100 -14 Q-20 -10 60 -16", C["wood_dk"], 3)
    stroke_only(s, "M-20 -46 L-12 -30 L-18 -22", INK, 3)
    s.circle((40, -24), 5, C["metal"], 3)
    stroke_only(s, "M40 -24 L52 -40", INK, 4)
    s.add("</g>")
    s.path("M-40 -6 Q-30 -40 0 -44 Q22 -42 28 -6 Z", C["rock"], 4.5)
    tuft(s, -150, 4)
    tuft(s, 140, 4)
    s.add("</g>")


OBSTACLES = {
    "obj_root": (obj_root, (-130, -150, 260, 150)),
    "obj_rock": (obj_rock, (-95, -120, 190, 120)),
    "obj_mushroom": (obj_mushroom, (-52, -104, 104, 104)),
    "obj_puddle": (obj_puddle, (-115, -30, 230, 30)),
    "obj_bucket": (obj_bucket, (-95, -125, 190, 125)),
    "obj_post": (obj_post, (-138, -58, 270, 58)),
}


# ============================================================== UI

TRACK = (84, 238, 344, 36)  # x, y, w, h of the progress track (same in scroll and fill)


def ui_scroll(s):
    s.path("M52 200 Q256 186 460 200 L460 312 Q256 326 52 312 Z", C["paper"], 5)
    stroke_only(s, "M60 214 Q256 200 452 214 M60 298 Q256 312 452 298", C["paper_dk"], 4)
    for x0, x1 in ((24, 64), (448, 488)):
        s.add(f'<rect x="{x0}" y="184" width="{x1 - x0}" height="144" rx="18" fill="{C["paper_dk"]}" stroke="{INK}" '
              f'stroke-width="5"/>')
        stroke_only(s, f"M{x0 + 10} 196 L{x0 + 10} 316", C["paper"], 5)
        stroke_only(s, f"M{x1 - 10} 196 L{x1 - 10} 316", C["paper_edge"], 5)
        for y in (172, 340):
            s.ellipse(((x0 + x1) / 2, y), 14, 10, C["wood_dk"], 4)
    x, y, w, h = TRACK
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{C["paper_dk"]}" stroke="{INK}" '
          f'stroke-width="4"/>')
    s.add(f'<rect x="{x + 6}" y="{y + 5}" width="{w - 12}" height="6" rx="3" fill="{C["paper_edge"]}"/>')


def ui_scroll_fill(s):
    x, y, w, h = TRACK
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{C["fill"]}" stroke="{INK}" stroke-width="4"/>')
    s.add(f'<rect x="{x + 10}" y="{y + 6}" width="{w - 20}" height="8" rx="4" fill="{C["fill_lt"]}"/>')
    for i in range(int(w // 28)):
        xx = x + 20 + i * 28
        stroke_only(s, f"M{xx} {y + h - 6} L{xx + 12} {y + 16}", C["fill_dk"], 4)


def ui_scroll_marker(s):
    s.add(f'<g transform="translate({CX} {CX})">')
    s.ellipse((0, 20), 70, 14, C["gill"], 5)
    s.path("M-76 20 C-80 -76 76 -86 72 20 Q0 34 -76 20 Z", "#2f74d6", 6)
    for x, y, r in ((-46, -4, 11), (-12, -42, 10), (30, -30, 11), (56, 0, 7)):
        s.circle((x, y), r, "#ffffff", 4)
    s.add("</g>")


LABEL = (96, 206, 320, 100)  # x, y, w, h free area for button text


def plank(s, dy, shade):
    x, y, w, h = 76, 186 + dy, 360, 140
    if not dy:
        s.add(f'<rect x="{x + 4}" y="{y + 14}" width="{w}" height="{h}" rx="22" fill="#000000" opacity="0.18"/>')
    s.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="22" fill="{shade}" stroke="{INK}" stroke-width="6"/>')
    s.add(f'<rect x="{x + 12}" y="{y + 12}" width="{w - 24}" height="{h - 24}" rx="14" fill="none" '
          f'stroke="{C["wood_dk"]}" stroke-width="4"/>')
    for yy in (y + 46, y + 92):
        stroke_only(s, f"M{x + 24} {yy} Q{x + 120} {yy - 6} {x + 200} {yy + 2} Q{x + 280} {yy + 8} {x + w - 24} {yy}",
                    C["wood_dk"], 3)
    stroke_only(s, f"M{x + 60} {y + 26} q20 -4 40 0 M{x + 250} {y + 116} q20 4 40 0", C["wood_lt"], 4)
    for cx, cy in ((x + 28, y + 28), (x + w - 28, y + 28), (x + 28, y + h - 28), (x + w - 28, y + h - 28)):
        s.circle((cx, cy), 7, C["metal"], 3)
        s.circle((cx - 2, cy - 2), 2.5, C["metal_lt"], 0)


def ui_button(s):
    plank(s, 0, C["wood"])


def ui_button_pressed(s):
    plank(s, 10, "#b57d44")


def fx_starburst(s):
    pts = []
    rnd = random.Random(4)
    for i in range(24):
        a = math.radians(i * 15 - 90)
        r = (200 if i % 2 == 0 else 112) * rnd.uniform(0.9, 1.06)
        pts.append(f"{f2(CX + r * math.cos(a))} {f2(CX + r * math.sin(a))}")
    s.path("M" + " L".join(pts) + " Z", C["star"], 7)
    pts = []
    for i in range(16):
        a = math.radians(i * 22.5 - 80)
        r = 120 if i % 2 == 0 else 72
        pts.append(f"{f2(CX + r * math.cos(a))} {f2(CX + r * math.sin(a))}")
    s.path("M" + " L".join(pts) + " Z", C["star_or"], 5)
    s.circle((CX, CX), 48, "#fff6c8", 5)
    for x, y, r in ((CX - 210, CX - 160, 16), (CX + 200, CX - 180, 12), (CX + 214, CX + 150, 14), (CX - 190, CX + 180, 10)):
        s.path(f"M{x} {y - r} Q{x + 2} {y - 2} {x + r} {y} Q{x + 2} {y + 2} {x} {y + r} Q{x - 2} {y + 2} {x - r} {y} "
               f"Q{x - 2} {y - 2} {x} {y - r} Z", "#ffffff", 3.5)


def dust_frame(scale, spread, alpha, n=6):
    def fn(s):
        rnd = random.Random(12)
        s.add(f'<g opacity="{alpha}">')
        for i in range(n):
            a = math.radians(180 + i * 180 / (n - 1))
            r = rnd.uniform(26, 40) * scale
            x = CX + math.cos(a) * spread * 1.6
            y = GROUND - 30 + math.sin(a) * spread * 0.7 - r * 0.3
            s.circle((x, y), r, C["dust"], 4.5)
            s.circle((x - r * 0.3, y - r * 0.3), r * 0.4, "#ffffff", 0)
        s.add("</g>")
    return fn


def speed_frame(offset):
    def fn(s):
        rnd = random.Random(30)
        for i in range(9):
            y = 70 + i * 46 + rnd.uniform(-10, 10)
            length = rnd.uniform(140, 300)
            x = (rnd.uniform(0, 512) + offset) % 640 - 80
            th = rnd.uniform(5, 10)
            s.path(f"M{f2(x)} {f2(y)} L{f2(x + length)} {f2(y - th / 2)} Q{f2(x + length + 8)} {f2(y)} {f2(x + length)} "
                   f"{f2(y + th / 2)} Z", "#ffffff", 3, 'opacity="0.9"')
    return fn


UI = {
    "ui_scroll": [ui_scroll],
    "ui_scroll_fill": [ui_scroll_fill],
    "ui_scroll_marker": [ui_scroll_marker],
    "ui_button": [ui_button],
    "ui_button_pressed": [ui_button_pressed],
    "fx_starburst": [fx_starburst],
    "fx_dust": [dust_frame(0.5, 20, 1), dust_frame(0.85, 46, 1), dust_frame(1.05, 70, 0.85), dust_frame(0.8, 92, 0.45)],
    "fx_speedlines": [speed_frame(0), speed_frame(-110), speed_frame(-220)],
}


def main():
    OUT.mkdir(exist_ok=True)
    meta = dict(frame=F, groundY=GROUND, note="obstacle hitbox is x, y, w, h in canvas pixels; ground objects are "
                "drawn at the same pixel scale as the kid and wizard sprites", assets={})
    for name, frames in SACK.items():
        (OUT / f"{name}.svg").write_text(sheet(frames), encoding="utf-8")
        meta["assets"][name] = dict(frames=len(frames), fps=10, loop=name == "sack_wriggle", anchor="bottom-center")
    for name, (fn, (bx, by, bw, bh)) in OBSTACLES.items():
        (OUT / f"{name}.svg").write_text(sheet([fn]), encoding="utf-8")
        meta["assets"][name] = dict(frames=1, anchor="bottom-center",
                                    hitbox=dict(x=CX + bx, y=GROUND + by, w=bw, h=bh))
    for name, frames in UI.items():
        (OUT / f"{name}.svg").write_text(sheet(frames, wobble=name != "ui_scroll_fill"), encoding="utf-8")
        meta["assets"][name] = dict(frames=len(frames))
    meta["assets"]["fx_dust"].update(fps=12, loop=False, anchor="bottom-center")
    meta["assets"]["fx_speedlines"].update(fps=12, loop=True)
    for k in ("ui_scroll", "ui_scroll_fill"):
        meta["assets"][k]["track"] = dict(zip("xywh", TRACK))
    for k in ("ui_button", "ui_button_pressed"):
        meta["assets"][k]["label"] = dict(zip("xywh", (LABEL[0], LABEL[1] + (10 if "pressed" in k else 0), *LABEL[2:])))
    (OUT / "props.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print("props done")


if __name__ == "__main__":
    main()
