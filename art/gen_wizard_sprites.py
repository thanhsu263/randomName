"""Sprite sheets for the original villain: a lanky roll-call wizard with a burlap sack.

Each animation is one row of 512x512 frames, facing right, bottom-centered.
Outputs (in sprites/):
  wizard_<anim>.svg       one sheet per animation
  wizard_sprites.json     frame counts, fps, and per frame the sack mouth (catch hitbox)
Run:  python render_sprites.py wizard
"""
import json
import math

from gen_kid_sprites import INK, OUT, Svg, add, along, f2, limb_dir, rot

F = 512
GROUND = 500

COL = dict(
    skin="#f0d2b0", skin_b="#dcb994", robe="#5b3f8c", robe_b="#47306f", robe_dk="#3b2760", patch="#8a6cc0",
    belt="#c7a15a", hat="#3f7d4a", hat_dk="#2f5f38", star="#ffd23f", hair="#dcdce3", hair_dk="#b9b9c4",
    nose="#e98a7a", sock="#fdf7e8", stripe="#e8873a", stripe_b="#c96f2a", shoe="#e2b13c", shoe_b="#c3952c",
    sack="#c49563", sack_dk="#a27648", sack_in="#3a2a1a", rope="#8a6a3a", mouth="#6b1f1f", gold="#ffd23f",
)

THIGH, SHIN = 62, 62
UPPER, FORE = 58, 56
HIP_F, HIP_B = (8, 0), (-8, 0)
SHOULDER = (4, -98)
NECK = (8, -104)
HEAD_UP = 40


# ---------------------------------------------------------------- parts

def leg_geom(hip, th, bend):
    knee = along(hip, th, THIGH)
    ankle = along(knee, th - bend, SHIN)
    fd = limb_dir(th - bend)
    fwd = (fd[1], -fd[0])
    return knee, ankle, fd, fwd


def draw_leg(s, hip, th, bend, back):
    knee, ankle, fd, fwd = leg_geom(hip, th, bend)
    pts = [knee, ankle]
    d = f"M{f2(knee[0])} {f2(knee[1])} L{f2(ankle[0])} {f2(ankle[1])}"
    s.add(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="22" stroke-linecap="round"/>')
    s.add(f'<path d="{d}" fill="none" stroke="{COL["sock"]}" stroke-width="16" stroke-linecap="round"/>')
    s.add(f'<path d="{d}" fill="none" stroke="{COL["stripe_b"] if back else COL["stripe"]}" stroke-width="16" '
          f'stroke-dasharray="9 9"/>')
    ang = math.degrees(math.atan2(fwd[1], fwd[0]))
    a = (ankle[0] + fd[0] * 6, ankle[1] + fd[1] * 6)
    s.add(f'<g transform="translate({f2(a[0])} {f2(a[1])}) rotate({f2(ang)})">')
    s.path("M-14 -8 Q8 -14 34 -6 Q50 -6 47 -22 Q60 -16 54 -2 Q48 12 30 12 L-12 12 Q-20 4 -14 -8 Z",
           COL["shoe_b"] if back else COL["shoe"], 4)
    s.path("M-10 8 L30 8", "none", 0, f'stroke="#a8801f" stroke-width="3" stroke-linecap="round"')
    s.add("</g>")
    return pts


def draw_arm(s, shoulder, sh_abs, el, back):
    elbow = along(shoulder, sh_abs, UPPER)
    wrist = along(elbow, sh_abs + el, FORE - 10)
    hand = along(elbow, sh_abs + el, FORE)
    s.limb([shoulder, elbow, wrist], COL["robe_b"] if back else COL["robe"], 20)
    # flared cuff
    d = limb_dir(sh_abs + el)
    n = (d[1], -d[0])
    c0 = (wrist[0] - d[0] * 12, wrist[1] - d[1] * 12)
    pts = [add(c0, (n[0] * 11, n[1] * 11)), add(wrist, (n[0] * 18 + d[0] * 4, n[1] * 18 + d[1] * 4)),
           add(wrist, (-n[0] * 18 + d[0] * 4, -n[1] * 18 + d[1] * 4)), add(c0, (-n[0] * 11, -n[1] * 11))]
    s.path("M" + " L".join(f"{f2(x)} {f2(y)}" for x, y in pts) + " Z", COL["robe_dk"], 4)
    skin = COL["skin_b"] if back else COL["skin"]
    s.circle(hand, 11, skin, 4)
    s.circle(add(hand, (n[0] * 9 + d[0] * 2, n[1] * 9 + d[1] * 2)), 5, skin, 3)  # thumb
    return hand


def draw_robe(s, p, lean):
    """Skirt follows the knees so the long robe moves with the legs."""
    kF = leg_geom(HIP_F, *p["legF"])[0]
    kB = leg_geom(HIP_B, *p["legB"])[0]
    xs = [kF[0], kB[0]]
    hem_y = (kF[1] + kB[1]) / 2 + 26
    left, right = min(xs) - 30, max(xs) + 30
    wl, wr = rot((-30, -10), lean), rot((32, -10), lean)
    teeth = []
    n = 7
    for i in range(n + 1):
        x = right - (right - left) * i / n
        y = hem_y + (10 if i % 2 else 0)
        teeth.append(f"L{f2(x)} {f2(y)}")
    s.path(f"M{f2(wr[0])} {f2(wr[1])} {' '.join(teeth)} L{f2(wl[0])} {f2(wl[1])} Z", COL["robe"], 4.5)
    # patch on the skirt
    px, py = left + (right - left) * 0.3, hem_y - 26
    s.add(f'<rect x="{f2(px)}" y="{f2(py)}" width="24" height="18" rx="2" fill="{COL["patch"]}" stroke="{INK}" '
          f'stroke-width="3" transform="rotate(-8 {f2(px)} {f2(py)})"/>')
    return (left, hem_y + 10), (right, hem_y + 10)


def draw_torso(s):
    s.path("M-30 -6 Q-40 -60 -30 -96 Q-8 -112 22 -104 Q36 -70 32 -6 Q0 2 -30 -6 Z", COL["robe"], 4.5)
    s.path("M-24 -20 Q-32 -60 -24 -90", "none", 0, f'stroke="{COL["robe_dk"]}" stroke-width="6" stroke-linecap="round"')
    s.add(f'<rect x="-6" y="-70" width="24" height="22" rx="2" fill="{COL["patch"]}" stroke="{INK}" stroke-width="3" '
          f'transform="rotate(10 6 -59)"/>')
    s.add(f'<rect x="-2" y="-66" width="16" height="14" fill="none" stroke="{COL["robe_dk"]}" stroke-width="1.5" '
          f'stroke-dasharray="3 2" transform="rotate(10 6 -59)"/>')
    s.path("M-33 -24 Q0 -14 34 -24 L34 -14 Q0 -4 -33 -14 Z", COL["belt"], 3.5)
    s.path("M24 -16 Q30 4 24 18 M28 -16 Q38 2 36 14", "none", 3.5)


HAT = ("M-40 -40 Q-26 -110 -8 -158 Q6 -186 34 -180 Q52 -174 58 -150 Q38 -162 22 -152 "
       "Q20 -100 38 -40 Z")


def draw_head(s, face, t):
    s.ellipse((-26, 4), 8, 13, COL["skin"], 4)
    s.ellipse((0, 0), 31, 44, COL["skin"], 4.5)
    if face == "angry":
        s.ellipse((4, 6), 26, 34, "#ff7a6b", 0, extra='opacity="0.35"')
    # eyes
    eyes = ((10, -12, 6, 8), (30, -13, 5, 7.5))
    for x, y, rx, ry in eyes:
        if face in ("laugh",):
            s.path(f"M{x - rx} {y + 2} Q{x} {y - ry} {x + rx} {y + 2}", "none", 3.5)
        elif face == "squish":
            s.path(f"M{x - rx} {y - 5} L{x + rx * 0.6} {y} L{x - rx} {y + 5}", "none", 3.5)
        elif face == "dizzy":
            s.ellipse((x, y), rx, ry, "#ffffff", 3)
            pts = []
            for i in range(22):
                a = math.radians(t * 90 + i * 30)
                r = 0.5 + i * 0.25
                pts.append(f"{f2(x + r * math.cos(a))} {f2(y + r * math.sin(a) * 1.2)}")
            s.path("M" + " L".join(pts), "none", 2)
        else:
            big = face in ("shock", "shout")
            s.ellipse((x, y), rx + (1.5 if big else 0), ry + (2 if big else 0), "#ffffff", 3)
            s.circle((x + 2, y + 1), 2 if face == "shock" else 3.2, "#c0392b" if face == "angry" else INK, 0)
            if face in ("evil", "angry"):  # heavy lid
                s.path(f"M{x - rx - 1} {y - 1} Q{x} {y - ry - 4} {x + rx + 1} {y - 1} Z", COL["skin"], 3)
    # spectacles
    for x, y, r in ((10, -12, 12), (30, -13, 10)):
        s.circle((x, y), r, "#d8f0ff", 0, 'opacity="0.3"')
        s.circle((x, y), r, "none", 0, f'stroke="{INK}" stroke-width="3.5"')
    s.line((20, -12), (22, -12), INK, 3.5)
    s.line((-2, -13), (-24, -6), INK, 3.5)
    # bushy unibrow
    tilt = {"evil": 8, "angry": 14, "shout": 6, "shock": -10, "laugh": -4}.get(face, 0)
    s.path(f"M-6 {-28 - tilt * 0.3} Q4 {-40 - tilt * 0.2} 18 {-32 + tilt * 0.4} Q28 {-42 + tilt * 0.2} 42 {-30 + tilt} "
           f"Q30 {-26 + tilt * 0.6} 18 {-25 + tilt * 0.4} Q6 {-24 - tilt * 0.1} -6 {-28 - tilt * 0.3} Z", COL["hair"], 3.5)
    # mouth (under the moustache)
    if face in ("evil", "laugh", "angry"):
        s.path("M8 26 Q26 44 46 22 Q28 30 8 26 Z", COL["mouth"], 3.5)
        teeth = [(14, 27), (22, 29), (30, 29), (38, 26)]
        for i, (x, y) in enumerate(teeth):
            if i == 1:
                continue  # missing tooth
            s.path(f"M{x - 3} {y} L{x + 3} {y} L{x + 2} {y + 6} L{x - 2} {y + 6} Z",
                   COL["gold"] if i == 2 else "#fffbe8", 2)
    elif face in ("shout", "shock"):
        s.ellipse((26, 30), 10 if face == "shout" else 6, 13 if face == "shout" else 8, COL["mouth"], 3.5)
        if face == "shout":
            s.path("M18 22 L34 22 L32 27 L20 27 Z", "#fffbe8", 2)
    elif face == "dizzy":
        s.path("M12 30 q4 -4 8 0 q4 4 8 0 q4 -4 8 0", "none", 3)
        s.path("M28 32 Q32 46 38 34 Z", "#ff7f8a", 2.5)
    else:
        s.path("M12 30 Q24 26 40 30", "none", 3.5)
    # goatee, moustache, nose
    s.path("M8 34 Q24 48 40 34 Q36 64 28 86 Q16 62 8 34 Z", COL["hair"], 3.5)
    s.path("M18 50 Q24 64 27 78", "none", 0, f'stroke="{COL["hair_dk"]}" stroke-width="3" stroke-linecap="round"')
    s.path("M36 10 Q20 12 8 30 Q4 44 -2 52 Q14 44 22 26 Q30 18 38 16 Z", COL["hair"], 3.5)
    s.path("M38 10 Q52 14 58 34 Q62 46 66 52 Q50 46 46 28 Q42 20 36 16 Z", COL["hair"], 3.5)
    s.circle((40, 4), 11, COL["nose"], 4)
    s.circle((37, 0), 3, "#ffffff", 0)
    # hat
    s.ellipse((-2, -40), 50, 11, COL["hat_dk"], 4)
    s.path(HAT, COL["hat"], 4.5)
    s.path("M-38 -50 Q0 -42 36 -52 L37 -42 Q0 -32 -40 -40 Z", COL["belt"], 3.5)
    s.add(f'<rect x="-30" y="-110" width="26" height="22" rx="2" fill="{COL["hat_dk"]}" stroke="{INK}" stroke-width="3" '
          f'transform="rotate(-12 -17 -99)"/>')
    for (x, y, r) in ((14, -96, 8), (-6, -136, 6), (40, -168, 5)):
        pts = []
        for i in range(10):
            rr = r if i % 2 == 0 else r * 0.45
            a = math.radians(i * 36 - 90)
            pts.append(f"{f2(x + rr * math.cos(a))} {f2(y + rr * math.sin(a))}")
        s.path("M" + " L".join(pts) + " Z", COL["star"], 2.5)
    s.circle((58, -146), 7, COL["star"], 3)


def draw_sack(s, mouth, angle, full=False):
    s.add(f'<g transform="translate({f2(mouth[0])} {f2(mouth[1])}) rotate({f2(angle)})">')
    if full:
        s.path("M-22 8 C-86 30 -76 148 0 150 C76 148 86 30 22 8 Z", COL["sack"], 4.5)
        s.path("M-62 58 Q-70 74 -64 90 M60 92 Q68 106 62 122", "none", 3.5)
        s.path("M-22 8 Q0 -6 22 8 L14 -6 Q0 -16 -14 -6 Z", COL["sack_dk"], 3.5)
        s.path("M-16 2 Q0 10 16 2", "none", 0, f'stroke="{COL["rope"]}" stroke-width="6" stroke-linecap="round"')
    else:
        s.path("M-34 0 C-46 44 -36 108 0 112 C36 108 46 44 34 0 Z", COL["sack"], 4.5)
        s.path("M-18 30 Q-24 70 -12 96", "none", 0, f'stroke="{COL["sack_dk"]}" stroke-width="6" stroke-linecap="round"')
        s.add(f'<rect x="6" y="56" width="22" height="20" rx="2" fill="{COL["sack_dk"]}" stroke="{INK}" stroke-width="3" '
              f'transform="rotate(8 17 66)"/>')
        s.ellipse((0, 0), 34, 17, COL["sack_in"], 4)
        s.ellipse((0, 0), 34, 17, "none", 0, extra=f'stroke="{COL["rope"]}" stroke-width="4"')
    s.add("</g>")


# ---------------------------------------------------------------- pose solving

def sack_mouth(hand, angle):
    """The hand grips the near rim, so the opening sits just beyond it."""
    return add(hand, rot((26, 4), angle))


def skeleton(p):
    lean = p.get("lean", 0)
    sh = rot(SHOULDER, lean)
    sh_b = add(sh, rot((-10, 2), lean))
    neck = rot(NECK, lean)
    ha = lean + p.get("head", 0)
    hc = add(neck, rot((0, -HEAD_UP), ha))
    return lean, sh, sh_b, hc, ha


def hand_pos(sh, rel, el, lean):
    e = along(sh, rel - lean, UPPER)
    return e, along(e, rel - lean + el, FORE)


def key_points(p):
    lean, sh, sh_b, hc, ha = skeleton(p)
    pts = []
    for hip, (th, bend) in ((HIP_F, p["legF"]), (HIP_B, p["legB"])):
        knee, ankle, fd, fwd = leg_geom(hip, th, bend)
        for k in (-14, 20, 52):
            pts.append((add(ankle, (fwd[0] * k + fd[0] * 18, fwd[1] * k + fd[1] * 18)), 3))
        pts.append((knee, 30))
    for shp, (rel, el) in ((sh, p["armF"]), (sh_b, p["armB"])):
        e, h = hand_pos(shp, rel, el, lean)
        pts += [(e, 14), (h, 14)]
    pts.append((hc, 46))
    for x, y in ((-52, -40), (50, -40), (-8, -158), (34, -182), (64, -146), (66, 54), (28, 88)):
        pts.append((add(hc, rot((x, y), ha)), 4))
    for x, y in ((-34, -6), (34, -6), (-34, -96), (24, -106)):
        pts.append((rot((x, y), lean), 4))
    _, hF = hand_pos(sh, *p["armF"], lean)
    ang = p.get("sack", 0)
    full = p.get("full", False)
    hF = sack_mouth(hF, ang)
    for x, y in ((-36, 0), (36, 0), (0, 112), (-44, 60), (44, 60)) if not full else ((-80, 80), (80, 80), (0, 152)):
        pts.append((add(hF, rot((x, y), ang)), 4))
    return pts


def place(p):
    r = p.get("rot", 0)
    world = [(rot(q, r), pad) for q, pad in key_points(p)]
    hx = p.get("x", 256)
    hy = GROUND - p.get("lift", 0) - max(q[1] + pad for q, pad in world)
    minx = min(q[0] - pad for q, pad in world) + hx
    maxx = max(q[0] + pad for q, pad in world) + hx
    top = min(q[1] - pad for q, pad in world) + hy
    if minx < 4:
        hx += 4 - minx
    elif maxx > F - 4:
        hx -= maxx - (F - 4)
    if top < 2 or maxx - minx > F - 8:
        print(f"  warning: pose does not fit (top {top:.0f}, width {maxx - minx:.0f})")
    return hx, hy, r


def draw_wizard(s, p, t):
    lean, sh, sh_b, hc, ha = skeleton(p)
    draw_arm(s, sh_b, p["armB"][0] - lean, p["armB"][1], True)
    draw_leg(s, HIP_B, *p["legB"], True)
    draw_leg(s, HIP_F, *p["legF"], False)
    draw_robe(s, p, lean)
    s.add(f'<g transform="rotate({f2(lean)})">')
    draw_torso(s)
    s.add("</g>")
    s.add(f'<g transform="translate({f2(hc[0])} {f2(hc[1])}) rotate({f2(ha)})">')
    draw_head(s, p["face"], t)
    s.add("</g>")
    _, hF = hand_pos(sh, *p["armF"], lean)
    hF = sack_mouth(hF, p.get("sack", 0))
    draw_sack(s, hF, p.get("sack", 0), p.get("full", False))
    draw_arm(s, sh, p["armF"][0] - lean, p["armF"][1], False)
    return hF, hc, ha


# ---------------------------------------------------------------- effects (frame space)

def fx_star(s, c, r, a):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        ang = math.radians(a + i * 36 - 90)
        pts.append(f"{f2(c[0] + rr * math.cos(ang))} {f2(c[1] + rr * math.sin(ang))}")
    s.path("M" + " L".join(pts) + " Z", "#ffd23f", 3)


def effects(s, fx, head_w):
    for e in fx:
        k = e[0]
        if k == "dust":
            x, n, r = e[1], e[2], e[3]
            for i in range(n):
                c = (x + (i - (n - 1) / 2) * r * 1.5, GROUND - r * (0.8 + 0.3 * (i % 2)))
                rr = r * (0.8 + 0.25 * (i % 2))
                s.circle(c, rr, "#efe3c8", 3.5)
                s.circle((c[0] - rr * 0.25, c[1] - rr * 0.25), rr * 0.45, "#ffffff", 0)
        elif k == "impact":
            x, y = e[1], e[2]
            for a in (-160, -125, -90, -55, -20):
                d = (math.cos(math.radians(a)), math.sin(math.radians(a)))
                s.line((x + d[0] * 26, y + d[1] * 26), (x + d[0] * 50, y + d[1] * 50), INK, 5)
        elif k == "stars":
            cx, cy = head_w[0] + e[2], head_w[1] + e[3]
            for i in range(4):
                a = math.radians(e[1] + i * 90)
                fx_star(s, (cx + 60 * math.cos(a), cy + 18 * math.sin(a)), 13 + 3 * math.sin(a), e[1] + i * 30)
        elif k == "steam":
            for side in (-1, 1):
                for i in range(3):
                    c = (head_w[0] + side * (52 + i * 16) + e[1], head_w[1] - 14 - i * 30)
                    s.circle(c, 15 - i * 3, "#f4f4f4", 3.5)
                    s.circle((c[0] + side * 10, c[1] - 10), 9 - i * 2, "#f4f4f4", 3)
        elif k == "speed":
            for i, y in enumerate((200, 260, 320)):
                s.line((20 + i * 10, y), (90 + i * 10, y), "#b7a58a", 5)
        elif k == "swoosh":
            x, y = e[1], e[2]
            s.path(f"M{x - 120} {y - 90} Q{x - 20} {y - 150} {x + 60} {y - 40}", "none", 0,
                   'stroke="#b7a58a" stroke-width="6" stroke-linecap="round" stroke-dasharray="18 12"')


# ---------------------------------------------------------------- animations

def run_frames():
    out = []
    for i in range(8):
        ph = 2 * math.pi * i / 8
        def leg(q):
            return (18 + 46 * math.sin(q), 14 + 88 * max(0.0, math.cos(q)))
        out.append(dict(
            x=250, lean=34, head=-26, face="evil", legF=leg(ph), legB=leg(ph + math.pi),
            armF=(70 + 18 * math.sin(ph + math.pi), 20), armB=(15 + 55 * math.sin(ph), 40),
            sack=-30 + 32 * math.sin(ph), lift=10 * abs(math.sin(ph)),
        ))
    return out


LUNGE = [
    dict(x=200, lean=8, head=-10, face="evil", legF=(45, 75), legB=(-12, 18), armF=(215, 10), armB=(-30, 30), sack=10),
    dict(x=230, lean=45, head=-25, face="shout", legF=(70, 90), legB=(-40, 20), armF=(150, 10), armB=(-60, 20), sack=120,
         fx=[("swoosh", 380, 160)]),
    dict(x=250, lean=64, head=-35, face="shout", legF=(60, 60), legB=(-55, 10), armF=(115, 0), armB=(-70, 10), sack=90),
    dict(x=250, lean=74, head=-40, face="evil", legF=(72, 96), legB=(-60, 10), armF=(95, 0), armB=(-40, 30), sack=160,
         fx=[("dust", 420, 4, 14)]),
    dict(x=240, lean=40, head=-20, face="evil", legF=(50, 60), legB=(-30, 20), armF=(130, 30), armB=(-20, 40), sack=-10,
         full=True),
    dict(x=230, lean=8, head=-15, face="laugh", legF=(15, 10), legB=(-10, 5), armF=(115, -15), armB=(60, 85), sack=0,
         full=True),
]

FALL = [
    dict(x=250, lean=74, head=-40, face="shock", legF=(72, 96), legB=(-60, 10), armF=(95, 0), armB=(-40, 30), sack=160,
         fx=[("dust", 420, 3, 12)]),
    dict(x=256, rot=25, lean=70, head=-30, face="shock", legF=(-20, 20), legB=(-60, 30), armF=(110, 0), armB=(60, 20),
         sack=170, lift=30),
    dict(x=262, rot=50, lean=60, face="shock", legF=(-40, 30), legB=(-70, 20), armF=(140, 0), armB=(120, 0), sack=180,
         lift=24),
    dict(x=262, rot=76, lean=20, face="squish", legF=(-45, 30), legB=(-60, 10), armF=(170, 0), armB=(160, 0), sack=120,
         fx=[("dust", 430, 4, 14), ("impact", 440, 470)]),
    dict(x=250, rot=90, face="dizzy", legF=(-30, 90), legB=(-15, 60), armF=(175, 0), armB=(165, 0), sack=90,
         fx=[("stars", 0, 0, -60)]),
    dict(x=250, rot=90, face="dizzy", legF=(-20, 60), legB=(-30, 95), armF=(175, 0), armB=(165, 0), sack=90,
         fx=[("stars", 45, 0, -60)]),
]

STOMP = [
    dict(lean=5, head=5, face="angry", legF=(62, 105), legB=(0, 0), armF=(40, 60), armB=(20, 95), sack=-10,
         fx=[("steam", 0)]),
    dict(lean=10, face="angry", legF=(15, 5), legB=(-5, 5), armF=(30, 50), armB=(15, 85), sack=20,
         fx=[("steam", 8), ("dust", 300, 3, 12), ("impact", 300, 470)]),
    dict(lean=5, face="angry", legF=(0, 0), legB=(55, 105), armF=(120, 10), armB=(30, 95), sack=-50,
         fx=[("steam", -6)]),
    dict(lean=10, face="angry", legF=(5, 5), legB=(-10, 5), armF=(60, 40), armB=(20, 85), sack=30,
         fx=[("steam", 10), ("dust", 220, 3, 12), ("impact", 220, 470)]),
]

ANIMS = {
    "run": (run_frames(), 12, True),
    "lunge": (LUNGE, 10, False),
    "fall": (FALL, 10, False),
    "stomp": (STOMP, 8, True),
}


def sheet(frames):
    s = Svg()
    n = len(frames)
    s.add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{F * n}" height="{F}" viewBox="0 0 {F * n} {F}">')
    s.add('<defs><filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">'
          '<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="n"/>'
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>'
          '</filter></defs>')
    meta = []
    for i, p in enumerate(frames):
        hx, hy, r = place(p)
        s.add(f'<g transform="translate({i * F} 0)"><g filter="url(#wobble)">')
        s.add(f'<g transform="translate({f2(hx)} {f2(hy)}) rotate({f2(r)})">')
        hF, hc, ha = draw_wizard(s, p, i)
        s.add("</g>")
        head_w = add((hx, hy), rot(hc, r))
        effects(s, p.get("fx", []), head_w)
        s.add("</g></g>")
        m = {}
        if not p.get("full"):
            mw = add((hx, hy), rot(hF, r))
            face = rot((0, -1), p.get("sack", 0) + r)
            m["sackMouth"] = dict(x=round(mw[0], 1), y=round(mw[1], 1), r=34,
                                  facing=round(math.degrees(math.atan2(face[1], face[0])), 1))
        else:
            m["sackFull"] = True
        meta.append(m)
    s.add("</svg>")
    return "\n".join(s.parts), meta


def main():
    OUT.mkdir(exist_ok=True)
    manifest = dict(frame=F, groundY=GROUND, facing="right",
                    note="sackMouth: centre, radius and facing angle (deg, 0 = right, 90 = down) of the open sack, "
                         "for catch hit-tests; sackFull: sack is closed with a catch inside",
                    anims={})
    for name, (frames, fps, loop) in ANIMS.items():
        print("wizard", name)
        svg, meta = sheet(frames)
        (OUT / f"wizard_{name}.svg").write_text(svg, encoding="utf-8")
        manifest["anims"][name] = dict(frames=len(frames), fps=fps, loop=loop, frameData=meta)
    (OUT / "wizard_sprites.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
