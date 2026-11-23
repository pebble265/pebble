"""สร้างหน้าเช็กอิน 7 แบบ (16x16) ให้เข้ากับสไตล์ Mochi ของทีม: ตาขาวขอบฟ้า เรืองแสงน้ำเงิน พื้นกรมท่า"""
import math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 16
SS = 8                      # supersample
W = N * SS
FRAMES = 40                 # ต่อ 1 รอบ
DELAY = 70                  # ms ต่อเฟรม (รอบละ 2.8 วินาที)

BG = np.array([0, 0, 16], float)
GLOW = np.array([0, 60, 170], float)
EDGE = np.array([165, 219, 255], float)
WHITE = np.array([255, 255, 255], float)
TEAR = np.array([120, 225, 255], float)
PINK = np.array([255, 105, 175], float)
BLUSH = np.array([255, 70, 130], float)
RED = np.array([255, 30, 50], float)
GOLD = np.array([255, 205, 40], float)


def canvas():
    im = Image.new("L", (W, W), 0)
    return im, ImageDraw.Draw(im)


def S(v):
    return v * SS


def to_mask(im):
    return np.clip((np.asarray(im.resize((N, N), Image.BOX), float) / 255.0) * 1.35, 0, 1) ** 0.75


def glow_of(im, r=1.1):
    g = im.filter(ImageFilter.GaussianBlur(S(r)))
    return np.clip(to_mask(g) * 1.6, 0, 1)


def colorize(core_im, layers=()):
    """core_im: ตา/ปาก สีขาวแบบทีม; layers: [(im, color)] สีเสริม (น้ำตา หัวใจ แก้ม)"""
    out = np.tile(BG, (N, N, 1))
    def add(im, col):
        nonlocal out
        c = to_mask(im)[..., None]
        g = glow_of(im)[..., None]
        out = out + GLOW * g * (1 - c) * 0.9
        tint = np.where(c > 0.55, WHITE * 0.1 + col * 0.9, col) if col is not WHITE else None
        if col is WHITE:
            ramp = np.where(c < 0.5, GLOW + (EDGE - GLOW) * (c / 0.5), EDGE + (WHITE - EDGE) * ((c - 0.5) / 0.5))
            out = out * (1 - c) + ramp * c
        else:
            out = out * (1 - c) + tint * c
    add(core_im, WHITE)
    for im, col in layers:
        add(im, col)
    return np.clip(out, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ shapes (พิกัดเป็นหน่วยพิกเซลจอ 0..16)
def eye_pill(d, cx, top, bot, w=3.0):
    d.rounded_rectangle([S(cx - w / 2), S(top), S(cx + w / 2), S(bot)], radius=S(w / 2 * 0.9), fill=255)


def arc(d, cx, cy, rx, ry, a0, a1, width=1.2):
    d.arc([S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)], a0, a1, fill=255, width=int(S(width)))


def line(d, pts, width=1.2):
    d.line([(S(x), S(y)) for x, y in pts], fill=255, width=int(S(width)), joint="curve")
    for x, y in (pts[0], pts[-1]):
        r = S(width) / 2
        d.ellipse([S(x) - r, S(y) - r, S(x) + r, S(y) + r], fill=255)


def drop(d, x, y, s=1.0):
    r = 0.75 * s
    d.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=255)
    d.polygon([(S(x - r * .8), S(y - r * .3)), (S(x + r * .8), S(y - r * .3)), (S(x), S(y - r * 2.1))], fill=255)


def heart(d, cx, cy, s):
    pts = []
    for i in range(40):
        t = i / 40 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((S(cx + x / 17 * s), S(cy + y / 17 * s)))
    d.polygon(pts, fill=255)


def blink_scale(t, at=(0.55,), dur=0.06):
    for a in at:
        k = abs(t - a)
        if k < dur:
            return k / dur
    return 1.0


# ------------------------------------------------------------------ faces
def f_cry(t):                     # 1 😭 แย่มาก: ตาหยี ปากเปิดสั่น น้ำตาไหลเป็นสาย
    core, d = canvas()
    sh = 0.25 * math.sin(t * 2 * math.pi * 6)
    line(d, [(1.8, 4.6), (4.6, 6.2 + sh)], 1.3); line(d, [(1.8, 7.6), (4.6, 6.2 + sh)], 1.3)
    line(d, [(14.2, 4.6), (11.4, 6.2 + sh)], 1.3); line(d, [(14.2, 7.6), (11.4, 6.2 + sh)], 1.3)
    o = 0.4 * math.sin(t * 2 * math.pi * 4)
    d.ellipse([S(6.0), S(9.6 + o * .3), S(10.0), S(13.2 + o)], fill=255)
    hole, dh = canvas(); dh.ellipse([S(6.9), S(10.5 + o * .3), S(9.1), S(12.4 + o)], fill=255)
    core = Image.fromarray(np.clip(np.asarray(core, int) - np.asarray(hole, int), 0, 255).astype(np.uint8))
    tears, dt = canvas()
    for side in (3.0, 13.0):
        for k in range(3):
            p = (t * 2 + k / 3) % 1
            drop(dt, side + (0.4 if side < 8 else -0.4) * p, 8.0 + p * 8.0, 0.95)
        dt.rectangle([S(side - .45), S(7.6), S(side + .45), S(9.0)], fill=255)
    return colorize(core, [(tears, TEAR)])


def f_teary(t):                   # 2 🥹 เศร้า: ตาโตมีน้ำคลอ ปากเม้มสั่น น้ำตาค่อย ๆ หยด
    core, d = canvas()
    bob = 0.15 * math.sin(t * 2 * math.pi * 2)
    d.ellipse([S(1.6), S(3.0 + bob), S(5.8), S(9.4 + bob)], fill=255)
    d.ellipse([S(10.2), S(3.0 + bob), S(14.4), S(9.4 + bob)], fill=255)
    hole, dh = canvas()
    for cx in (3.7, 12.3):
        dh.ellipse([S(cx - 1.3), S(5.2 + bob), S(cx + 0.3), S(7.6 + bob)], fill=255)
    core = Image.fromarray(np.clip(np.asarray(core, int) - (np.asarray(hole, int) * 0.55).astype(int), 0, 255).astype(np.uint8))
    w = 0.35 * math.sin(t * 2 * math.pi * 3)
    line(d := ImageDraw.Draw(core), [(5.6, 12.2 + w), (6.8, 11.2 - w), (8.0, 12.2 + w), (9.2, 11.2 - w), (10.4, 12.2 + w)], 1.3)
    tears, dt = canvas()
    for cx in (3.7, 12.3):
        dt.ellipse([S(cx - 2.0), S(8.3 + bob), S(cx + 2.0), S(9.7 + bob)], fill=255)
    p = (t * 1.0) % 1
    if p > 0.35:
        q = (p - 0.35) / 0.65
        drop(dt, 2.2, 9.6 + q * 6.0, 0.8)
    return colorize(core, [(tears, TEAR)])


def f_sad(t):                     # 3 😢 ไม่ค่อยดี: ตาตก คิ้วเศร้า ปากคว่ำ น้ำตาหยดข้างเดียว
    core, d = canvas()
    b = blink_scale(t, (0.7,))
    for cx in (3.4, 12.6):
        h = 5.0 * b
        if h > 0.8:
            eye_pill(d, cx, 8.0 - h, 8.2, 3.0)
        else:
            line(d, [(cx - 1.5, 7.8), (cx + 1.5, 7.8)], 1.0)
    line(d, [(1.6, 1.4), (5.0, 2.6)], 1.2); line(d, [(14.4, 1.4), (11.0, 2.6)], 1.2)
    arc(d, 8.0, 13.8, 3.0, 2.4, 205, 335, 1.6)
    tears, dt = canvas()
    p = t % 1
    drop(dt, 4.6, 9.0 + p * 7.0, 0.85)
    return colorize(core, [(tears, TEAR)])


def f_calm(t):                    # 4 😌 เฉย ๆ: หลับตาสบาย ยิ้มบาง หายใจช้า ๆ
    core, d = canvas()
    y = 0.35 * math.sin(t * 2 * math.pi)
    arc(d, 3.5, 5.6 + y, 2.4, 1.9, 15, 165, 1.7)
    arc(d, 12.5, 5.6 + y, 2.4, 1.9, 15, 165, 1.7)
    arc(d, 8.0, 10.2 + y, 2.0, 1.5, 20, 160, 1.4)
    return colorize(core)


def f_peace(t):                   # 5 ☺️ สงบ: ตายิ้ม ^ ^ แก้มชมพู โยกเบา ๆ
    core, d = canvas()
    x = 0.4 * math.sin(t * 2 * math.pi)
    arc(d, 3.5 + x, 7.2, 2.4, 2.3, 195, 345, 1.7)
    arc(d, 12.5 + x, 7.2, 2.4, 2.3, 195, 345, 1.7)
    arc(d, 8.0 + x, 10.0, 2.1, 1.6, 20, 160, 1.4)
    bl, db = canvas()
    a = 0.55 + 0.25 * math.sin(t * 2 * math.pi)
    for cx in (2.4, 13.6):
        db.ellipse([S(cx - 1.4 + x), S(8.6), S(cx + 1.4 + x), S(10.0)], fill=int(255 * a))
    return colorize(core, [(bl, BLUSH)])


def f_happy(t):                   # 6 😊 ดี: ตายิ้ม ยิ้มกว้าง กระเด้ง
    core, d = canvas()
    y = -0.6 * abs(math.sin(t * 2 * math.pi * 2))
    arc(d, 3.5, 6.8 + y, 2.4, 2.4, 195, 345, 1.7)
    arc(d, 12.5, 6.8 + y, 2.4, 2.4, 195, 345, 1.7)
    d.chord([S(5.2), S(7.6 + y), S(10.8), S(13.2 + y)], 0, 180, fill=255)
    bl, db = canvas()
    for cx in (2.2, 13.8):
        db.ellipse([S(cx - 1.3), S(9.0 + y), S(cx + 1.3), S(10.3 + y)], fill=170)
    sp, ds = canvas()                                     # gold sparkles twinkling around
    w = max(1, int(S(0.55)))
    for k, (x, yy) in enumerate(((1.2, 1.6), (14.6, 2.0), (1.0, 13.6), (15.0, 13.0))):
        a = math.sin((t * 2 + k * 0.27) * 2 * math.pi)
        if a > 0.15:
            r = 0.4 + 0.8 * a
            ds.line([(S(x - r), S(yy)), (S(x + r), S(yy))], fill=255, width=w)
            ds.line([(S(x), S(yy - r)), (S(x), S(yy + r))], fill=255, width=w)
    return colorize(core, [(bl, BLUSH), (sp, GOLD)])


def f_love(t):                    # 7 🥰 ดีมาก: ตาหัวใจเต้น หัวใจลอยขึ้น
    core, d = canvas()
    arc(d, 8.0, 10.6, 2.2, 1.6, 20, 160, 1.4)
    hearts, dh = canvas()
    beat = 1.0 + 0.18 * max(0, math.sin(t * 2 * math.pi * 2)) ** 3
    heart(dh, 3.6, 6.4, 2.6 * beat); heart(dh, 12.4, 6.4, 2.6 * beat)
    for k, x0 in enumerate((1.6, 14.2)):
        p = (t + k * 0.5) % 1
        if p < 0.8:
            heart(dh, x0 + 0.5 * math.sin(p * 6), 13.5 - p * 13, 1.0)
    return colorize(core, [(hearts, RED)])


FACES = [("cry", f_cry), ("teary", f_teary), ("sad", f_sad), ("calm", f_calm),
         ("peace", f_peace), ("happy", f_happy), ("love", f_love)]


def render_all():
    out = {}
    for name, fn in FACES:
        out[name] = [fn(i / FRAMES) for i in range(FRAMES)]
    return out


def rgb565(c):
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)


if __name__ == "__main__":
    import sys, base64
    faces = render_all()
    # header for the ESP32
    lines = ["// สร้างอัตโนมัติจาก gen_faces.py ห้ามแก้ด้วยมือ (RGB565, 16x16)",
             "// หน้าเช็กอินความรู้สึก 7 แบบ วาดให้เข้ากับสไตล์ Mochi ของทีม",
             "#pragma once", "#include <Arduino.h>", "",
             f"#define CHECKIN_FACE_COUNT {len(FACES)}", f"#define CHECKIN_FACE_FRAMES {FRAMES}",
             f"#define CHECKIN_FACE_DELAY {DELAY}   // ms ต่อเฟรม", "",
             "const char* const CHECKIN_FACE_NAMES[CHECKIN_FACE_COUNT] = {" + ", ".join(f'"{n}"' for n, _ in FACES) + "};", "",
             "const uint16_t CHECKIN_FACE_PIXELS[CHECKIN_FACE_COUNT][CHECKIN_FACE_FRAMES][256] PROGMEM = {"]
    for name, _ in FACES:
        lines.append(f"  {{ // {name}")
        for fr in faces[name]:
            px = [rgb565(fr[y, x]) for y in range(N) for x in range(N)]
            lines.append("    {" + ",".join(f"0x{v:04x}" for v in px) + "},")
        lines.append("  },")
    lines.append("};")
    open(sys.argv[1], "w").write("\n".join(lines) + "\n")
    # preview data for the 3D simulator
    raw = bytearray()
    meta = {}
    for i, (name, _) in enumerate(FACES):
        meta[name] = [i * FRAMES, FRAMES]
        for fr in faces[name]:
            raw += fr.astype(np.uint8).tobytes()
    json.dump({"anims": meta, "delay": DELAY, "rgb": base64.b64encode(bytes(raw)).decode()}, open(sys.argv[2], "w"), separators=(",", ":"))
    # preview image
    sc, gap = 10, 6
    sheet = Image.new("RGB", (8 * (N * sc + gap), len(FACES) * (N * sc + gap)), (40, 40, 40))
    for r, (name, _) in enumerate(FACES):
        for k in range(8):
            fr = Image.fromarray(faces[name][k * FRAMES // 8]).resize((N * sc, N * sc), Image.NEAREST)
            sheet.paste(fr, (k * (N * sc + gap), r * (N * sc + gap)))
    sheet.save(sys.argv[3])
    print("ok")
