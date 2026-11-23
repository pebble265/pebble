"""16x16 WS2812B LED face driven straight from the Raspberry Pi 5 (no ESP32 needed).

Takes the same JSON commands the ESP32 firmware understood, so the rest of the app,
the phone's test screen and the Pi touch screen work unchanged:
  {"cmd":"face","mood":"happy"}            mood -> Mochi animation (idle = calm face + random fun faces)
  {"cmd":"face","anim":"heart_eyes"}       any animation by name (mochi / fun / check-in), "loops":N (0 = forever)
  {"cmd":"emoji","score":1..7,"ms":6000}   mood check-in face, then back to normal
  {"cmd":"brightness","value":0..255}
  {"cmd":"face","anim":"off"}              panel off
Pixels go out on GPIO22 through the Pi 5's PIO (Adafruit-Blinka-Raspberry-Pi5-Neopixel),
or on GPIO10 through SPI. Frames come from led_data/faces.bin (made from the ESP32 .h files).
"""
from __future__ import annotations

import json
import logging
import os
import random
import struct
import threading
import time

log = logging.getLogger("led")
HERE = os.path.dirname(os.path.abspath(__file__))
W = H = 16
N = W * H

# same table as MOOD_FACES in the ESP32 firmware
MOOD_ANIMS = {
    "happy": "happy", "listening": "content", "thinking": "confused_2", "speaking": "happy_2",
    "concerned": "embarrassed", "alert": "excited_2", "pairing": "intro", "offline": "sleepy_3",
    "sleepy": "sleepy", "boot": "intro", "music": "music",
}
CHECKIN = ["cry", "teary", "sad", "calm", "peace", "happy", "love"]   # score 1..7
FUN = ["heart_eyes", "star_eyes", "blush", "rainbow", "wink"]
IDLE = "mochi/content"

# ---- drivers -------------------------------------------------------------------------
def _enc(v):
    bits = 0
    for i in range(7, -1, -1):
        bits = (bits << 3) | (0b110 if (v >> i) & 1 else 0b100)
    return bits.to_bytes(3, "big")


class _SpiOut:
    def __init__(self):
        import spidev
        self.spi = spidev.SpiDev()
        self.spi.open(0, 0)
        self.spi.max_speed_hz = 2_400_000
        self.spi.mode = 0
        self.enc = [_enc(v) for v in range(256)]

    def write(self, grb: bytes):
        out = bytearray(b"\0")
        for v in grb:
            out += self.enc[v]
        out += bytes(100)
        self.spi.xfer3(bytes(out)) if hasattr(self.spi, "xfer3") else self.spi.writebytes2(out)


class _PioOut:
    def __init__(self, pin: int):
        import board
        from adafruit_raspberry_pi5_neopixel_write import neopixel_write
        self.pin = getattr(board, f"D{pin}")
        self.nw = neopixel_write

    def write(self, grb: bytes):
        self.nw(self.pin, grb)


def _xy(x, y):                      # snake wiring, starts top-left (same as the ESP32 firmware)
    return y * W + (W - 1 - x if y & 1 else x)

MAP = [_xy(i % W, i // W) for i in range(N)]


def _rgb565(c):
    r, g, b = (c >> 11) & 31, (c >> 5) & 63, c & 31
    return (r << 3 | r >> 2, g << 2 | g >> 4, b << 3 | b >> 2)


# ---- the face ------------------------------------------------------------------------
class LedFace:
    def __init__(self, pin: int = 22, bright: float = 0.08, max_bright: float = 0.15, max_amps: float = 1.0):
        self.pin = pin
        self.max_bright = max_bright
        self.bright = min(bright, max_bright)
        self.max_amps = max_amps
        self.out = _SpiOut() if pin == 10 else _PioOut(pin)
        self.index = json.load(open(os.path.join(HERE, "led_data", "faces.json")))
        self.raw = open(os.path.join(HERE, "led_data", "faces.bin"), "rb").read()
        self._cache: dict[str, list] = {}
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop = False
        self.now = IDLE         # animation on the panel
        self.mode = "idle"      # idle | play | emoji | off
        self.loops_left = 0
        self.until = 0.0
        self._fun_at = time.monotonic() + random.uniform(8, 15)
        self._th = threading.Thread(target=self._run, name="led", daemon=True)
        self._th.start()
        log.info("LED face on GPIO%d (%s), %d animations", pin, "SPI" if pin == 10 else "PIO", len(self.index))

    @classmethod
    def create(cls, **kw) -> "LedFace | None":
        try:
            return cls(**kw)
        except Exception as e:          # library missing, no /dev/pio0 ... the app keeps running without it
            log.warning("LED face off: %s", e)
            return None

    # ---- names ----
    def names(self) -> list[str]:
        return list(self.index)

    def resolve(self, name: str) -> str | None:
        if name in self.index:
            return name
        for group in ("mochi", "fun", "checkin"):
            if f"{group}/{name}" in self.index:
                return f"{group}/{name}"
        return None

    def _frames(self, key: str):
        f = self._cache.get(key)
        if f is None:
            a = self.index[key]
            f = []
            for k in range(a["start"], a["start"] + a["count"]):
                px = struct.unpack_from("<256H", self.raw, k * 512)
                f.append([_rgb565(c) for c in px])
            f = list(zip(f, a["delay"]))
            self._cache[key] = f
        return f

    # ---- commands (same JSON as the ESP32) ----
    def handle(self, msg: dict) -> bool:
        cmd = msg.get("cmd")
        if cmd == "face":
            anim = str(msg.get("anim", "") or "")
            if anim == "off":
                self.off()
            elif anim:
                self.play(anim, int(msg.get("loops", 0) or 0))
            else:
                self.mood(str(msg.get("mood", "idle")))
        elif cmd == "emoji":
            self.emoji(int(msg.get("score", 0)), int(msg.get("ms", 6000)))
        elif cmd == "brightness":
            self.set_brightness(int(msg.get("value", 25)))
        else:
            return False
        return True

    def _set(self, mode, key=None, loops=0, until=0.0):
        with self._lock:
            self.mode, self.loops_left, self.until = mode, loops, until
            if key:
                self.now = key
        self._wake.set()

    def idle(self):
        self._fun_at = time.monotonic() + random.uniform(8, 15)
        self._set("idle", IDLE)

    def mood(self, mood: str):
        if mood == "idle":
            if self.mode != "idle":
                self.idle()
            return
        a = MOOD_ANIMS.get(mood)
        if a and self.now != f"mochi/{a}":
            self._set("play", f"mochi/{a}", 0)

    def play(self, name: str, loops: int = 0):
        key = self.resolve(name)
        if not key:
            log.info("no LED animation %r", name)
            return
        if key.startswith("fun/") and loops == 0:
            loops = 1                     # fun faces play once, like on the ESP32
        self._set("play", key, max(0, loops))

    def emoji(self, score: int, ms: int = 6000):
        if 1 <= score <= 7:
            self._set("emoji", "checkin/" + CHECKIN[score - 1], 0, time.monotonic() + ms / 1000)

    def set_brightness(self, value: int):
        self.bright = max(0.0, min(self.max_bright, value / 255))

    def off(self):
        self._set("off")

    def stop(self):
        self._stop = True
        self._wake.set()
        self._th.join(timeout=1)
        try:
            self._show([(0, 0, 0)] * N)
        except Exception:
            pass

    def state(self) -> dict:
        return {"on": self.mode != "off", "now": self.now.split("/")[-1] if self.mode != "off" else "",
                "mode": self.mode, "bright": round(self.bright / self.max_bright * 100)}

    # ---- output ----
    def _show(self, px):
        s = self.bright
        amps = sum(r + g + b for r, g, b in px) / 255 * 0.020 * s
        if amps > self.max_amps:
            s *= self.max_amps / amps
        buf = bytearray(N * 3)
        for i, (r, g, b) in enumerate(px):
            j = MAP[i] * 3
            buf[j], buf[j + 1], buf[j + 2] = int(g * s), int(r * s), int(b * s)
        self.out.write(bytes(buf))

    def _run(self):
        blank = [(0, 0, 0)] * N
        while not self._stop:
            with self._lock:
                mode, key = self.mode, self.now
            if mode == "off":
                self._show(blank)
                self._wake.wait(); self._wake.clear()
                continue
            if mode == "idle" and time.monotonic() >= self._fun_at:
                self._set("play", "fun/" + random.choice(FUN), 1)
                continue
            interrupted = False
            for px, d in self._frames(key):
                t = time.monotonic()
                try:
                    self._show(px)
                except Exception as e:
                    log.warning("LED write failed: %s", e)
                    time.sleep(1)
                if self._wake.wait(max(0.0, d / 1000 - (time.monotonic() - t))):
                    self._wake.clear()
                    interrupted = True
                    break
                if self._stop:
                    return
            if interrupted:
                continue
            with self._lock:
                if self.mode == "play" and self.loops_left:
                    self.loops_left -= 1
                    if self.loops_left == 0:
                        self.mode, self.now = "idle", IDLE
                        self._fun_at = time.monotonic() + random.uniform(8, 15)
                elif self.mode == "emoji" and time.monotonic() >= self.until:
                    self.mode, self.now = "idle", IDLE
