"""ลูกเล่นสีสำหรับหน้าปกติ (16x16): ระหว่างกระพริบตา บางครั้งหุ่นจะทำหน้าพิเศษแป๊บหนึ่งแล้วกลับเป็นหน้าเดิม
ทุกท่าเริ่มและจบด้วยเฟรมตาเปิด/ตาปิดของทีม (content) จึงต่อกับการกระพริบตาได้เนียน

ใช้:  python3 gen_fun_faces.py ../pebble_medbot/mochi_frames.h ../pebble_medbot/fun_faces.h preview.json preview.png
"""
import colorsys, json, math, re, sys
import numpy as np
from PIL import Image, ImageDraw
from gen_checkin_faces import N, S, canvas, to_mask, glow_of, arc, line, heart, drop

DELAY = 70
BG = np.array([0, 0, 16], float)
WHITE = np.array([255, 255, 255], float)
EDGE = np.array([165, 219, 255], float)
BLUE_GLOW = np.array([0, 60, 170], float)
RED = np.array([255, 30, 50], float)
RED_GLOW = np.array([150, 0, 30], float)
PINK = np.array([255, 80, 150], float)
GOLD = np.array([255, 205, 40], float)
GOLD_GLOW = np.array([150, 80, 0], float)
CYAN = np.array([90, 230, 255], float)


def paint(layers):
    """layers: [(mask_image, color, glow_color, glow_strength)]"""
    out = np.tile(BG, (N, N, 1))
    for im, col, glow, gs in layers:
        c = to_mask(im)[..., None]
        if glow is not None:
            g = glow_of(im)[..., None]
            out = out + glow * g * (1 - c) * gs
        if col is WHITE:
            fill = np.where(c < 0.5, BLUE_GLOW + (EDGE - BLUE_GLOW) * (c / 0.5), EDGE + (WHITE - EDGE) * ((c - 0.5) / 0.5))
        else:
            fill = col
        out = out * (1 - c) + fill * c
    return np.clip(out, 0, 255).astype(np.uint8)


def mouth_small(d, y=10.1):
    arc(d, 8.0, y - 1.2, 1.7, 1.2, 25, 155, 1.3)


def star(d, cx, cy, r, rot=0.0, inner=0.45):
    pts = []
    for i in range(10):
        a = rot + i * math.pi / 5 - math.pi / 2
        rr = r if i % 2 == 0 else r * inner
        pts.append((S(cx + rr * math.cos(a)), S(cy + rr * math.sin(a))))
    d.polygon(pts, fill=255)


def sparkle(d, cx, cy, r):
    w = max(1, int(S(0.55)))
    d.line([(S(cx - r), S(cy)), (S(cx + r), S(cy))], fill=255, width=w)
    d.line([(S(cx), S(cy - r)), (S(cx), S(cy + r))], fill=255, width=w)


def pop(p):
    """0..1 -> springy scale that overshoots a little (eyes popping in)."""
    if p <= 0:
        return 0.0
    return 1 + math.sin(p * math.pi * 2.2) * math.exp(-p * 4.5) * 0.35 - (1 - min(p * 3, 1)) * 0.6


# ------------------------------------------------------------------ the middle part of each trick (t = 0..1)
def heart_eyes(t):
    core, d = canvas(); mouth_small(d, 11.0)
    hs, dh = canvas()
    s = 2.7 * max(0.0, pop(t * 1.6)) * (1 + 0.16 * max(0, math.sin(t * 2 * math.pi * 3)) ** 4)
    shine, dsh = canvas()
    if s > 0.2:
        heart(dh, 3.8, 6.2, s); heart(dh, 12.2, 6.2, s)
        if s > 2.2:
            for cx in (2.9, 11.3):
                dsh.ellipse([S(cx - 0.55), S(4.6), S(cx + 0.55), S(5.6)], fill=255)
    mini, dm = canvas()
    for k, x0 in enumerate((1.2, 14.8, 8.0)):
        p = (t * 1.3 + k * 0.33) % 1
        if t > 0.15 and p < 0.85:
            heart(dm, x0 + 0.6 * math.sin(p * 7 + k), 15.5 - p * 15.5, 0.9 + 0.2 * k)
    bl, db = canvas()
    for cx in (1.9, 14.1):
        db.ellipse([S(cx - 1.2), S(9.6), S(cx + 1.2), S(10.8)], fill=150)
    return paint([(core, WHITE, BLUE_GLOW, 0.9), (bl, PINK, None, 0), (mini, PINK, None, 0), (hs, RED, RED_GLOW, 1.0),
                  (shine, np.array([255, 190, 200], float), None, 0)])


def star_eyes(t):
    core, d = canvas(); arc(d, 8.0, 10.0, 2.0, 1.6, 20, 160, 1.4)
    st, ds = canvas()
    s = 2.9 * max(0.0, pop(t * 1.6))
    rot = 0.6 * math.sin(t * 2 * math.pi)
    if s > 0.2:
        star(ds, 3.8, 6.0, s, rot); star(ds, 12.2, 6.0, s, -rot)
    sp, dp = canvas()
    for k, (x, y) in enumerate(((1.0, 1.4), (14.6, 1.8), (8.0, 2.0), (1.4, 12.5), (14.4, 12.0))):
        a = math.sin((t * 3 + k * 0.37) * 2 * math.pi)
        if a > 0.2 and t > 0.12:
            sparkle(dp, x, y, 0.5 + 0.7 * a)
    return paint([(core, WHITE, BLUE_GLOW, 0.9), (sp, np.array([255, 250, 200], float), GOLD_GLOW, 0.6), (st, GOLD, GOLD_GLOW, 1.0)])


def blush(t):
    core, d = canvas()
    y = -0.4 * abs(math.sin(t * 2 * math.pi * 2))
    arc(d, 3.8, 7.6 + y, 2.6, 3.0, 190, 350, 2.0)
    arc(d, 12.2, 7.6 + y, 2.6, 3.0, 190, 350, 2.0)
    arc(d, 8.0, 9.4 + y, 2.0, 1.8, 20, 160, 1.5)
    bl, db = canvas()
    a = min(1.0, t * 4) * (0.7 + 0.3 * math.sin(t * 2 * math.pi * 2))
    for cx in (2.0, 14.0):
        db.ellipse([S(cx - 1.6), S(9.2 + y), S(cx + 1.6), S(11.0 + y)], fill=int(255 * a))
    hs, dh = canvas()
    if t > 0.25:
        p = (t - 0.25) / 0.75
        heart(dh, 13.0 + 0.5 * math.sin(p * 6), 4.0 - p * 5, 1.1)
    return paint([(core, WHITE, BLUE_GLOW, 0.9), (bl, PINK, None, 0), (hs, RED, RED_GLOW, 0.7)])


def rainbow(t):
    """Same eyes as always, but they glow through every colour."""
    eyes, d = canvas()
    for cx in (3.8, 12.2):
        d.rounded_rectangle([S(cx - 1.7), S(2.4), S(cx + 1.7), S(10.0)], radius=S(1.6), fill=255)
    m, dm = canvas(); mouth_small(dm, 10.9)
    h = (t * 1.5) % 1
    r, g, b = colorsys.hsv_to_rgb(h, 0.85, 1.0)
    col = np.array([r, g, b]) * 255
    r2, g2, b2 = colorsys.hsv_to_rgb((h + 0.5) % 1, 0.9, 0.6)
    return paint([(eyes, col, np.array([r2, g2, b2]) * 255, 0.8), (m, col, None, 0)])


def wink(t):
    core, d = canvas()
    d.rounded_rectangle([S(2.1), S(2.4), S(5.5), S(10.0)], radius=S(1.6), fill=255)   # left eye open
    arc(d, 12.2, 7.4, 2.6, 3.0, 190, 350, 2.0)                                         # right eye winks ^
    arc(d, 8.0, 9.6, 1.9, 1.5, 20, 160, 1.4)
    sp, ds = canvas()
    if t > 0.1:
        p = min(1.0, (t - 0.1) / 0.3)
        s = 1.8 * max(0.0, pop(p)) * (1 - max(0, t - 0.75) * 3)
        if s > 0.2:
            star(ds, 14.2, 2.0, s, t * 3)
    bl, db = canvas()
    db.ellipse([S(12.4), S(9.4), S(15.2), S(10.9)], fill=150)
    return paint([(core, WHITE, BLUE_GLOW, 0.9), (bl, PINK, None, 0), (sp, GOLD, GOLD_GLOW, 1.0)])


TRICKS = [("heart_eyes", heart_eyes, 40), ("star_eyes", star_eyes, 36), ("blush", blush, 36),
          ("rainbow", rainbow, 40), ("wink", wink, 26)]


def team_frames(path):
    t = open(path).read()
    names = dict((m[0], int(m[1])) for m in re.findall(r'\{"(\w+)", (\d+), \d+\}', t))
    body = t[t.index("MOCHI_PIXELS"):]
    frames = re.findall(r"\{(0x[0-9a-fA-F,x]+)\}", body)
    def img(f):
        px = [int(v, 16) for v in frames[f].split(",")]
        return np.array([[((p >> 11) << 3, ((p >> 5) & 63) << 2, (p & 31) << 3) for p in px[r * 16:(r + 1) * 16]] for r in range(16)], np.uint8)
    c = names["content"]
    return img(c + 10), img(c + 5)


def build(open_f, closed_f):
    out = {}
    for name, fn, n in TRICKS:
        frames = [open_f, closed_f, closed_f]                    # blink out of the normal face
        frames += [fn(i / (n - 1)) for i in range(n)]
        frames += [closed_f, closed_f, open_f]                   # and back in
        out[name] = frames
    return out


def rgb565(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)


if __name__ == "__main__":
    mochi, header, pjson, ppng = sys.argv[1:5]
    o, c = team_frames(mochi)
    tricks = build(o, c)
    total = sum(len(v) for v in tricks.values())
    L = ["// สร้างอัตโนมัติจาก tools/gen_fun_faces.py ห้ามแก้ด้วยมือ (RGB565, 16x16)",
         "// ลูกเล่นสีระหว่างหน้าปกติ: ตาหัวใจแดง, ตาดาวทอง, แก้มแดง, ตาสีรุ้ง, ขยิบตา",
         "#pragma once", "#include <Arduino.h>", "",
         f"#define FUN_FACE_COUNT {len(TRICKS)}", f"#define FUN_FACE_TOTAL_FRAMES {total}", f"#define FUN_FACE_DELAY {DELAY}", "",
         "struct FunFace { const char* name; uint16_t start; uint16_t count; };",
         "const FunFace FUN_FACES[FUN_FACE_COUNT] = {"]
    start = 0
    for name, _, _ in TRICKS:
        L.append(f'  {{"{name}", {start}, {len(tricks[name])}}},'); start += len(tricks[name])
    L += ["};", "", "const uint16_t FUN_FACE_PIXELS[FUN_FACE_TOTAL_FRAMES][256] PROGMEM = {"]
    for name, _, _ in TRICKS:
        L.append(f"  // {name}")
        for fr in tricks[name]:
            L.append("  {" + ",".join(f"0x{rgb565(fr[y, x]):04x}" for y in range(N) for x in range(N)) + "},")
    L.append("};")
    open(header, "w").write("\n".join(L) + "\n")

    import base64
    raw, meta, k = bytearray(), {}, 0
    for name, _, _ in TRICKS:
        meta[name] = [k, len(tricks[name])]; k += len(tricks[name])
        for fr in tricks[name]:
            raw += fr.astype(np.uint8).tobytes()
    json.dump({"anims": meta, "delay": DELAY, "rgb": base64.b64encode(bytes(raw)).decode()}, open(pjson, "w"), separators=(",", ":"))

    sc, gap, cols = 10, 6, 8
    sheet = Image.new("RGB", (cols * (N * sc + gap), len(TRICKS) * (N * sc + gap)), (40, 40, 40))
    for r, (name, _, _) in enumerate(TRICKS):
        fr_list = tricks[name][3:-3]
        for j in range(cols):
            fr = Image.fromarray(fr_list[j * len(fr_list) // cols]).resize((N * sc, N * sc), Image.NEAREST)
            sheet.paste(fr, (j * (N * sc + gap), r * (N * sc + gap)))
    sheet.save(ppng)
    print("ok", total, "frames")
