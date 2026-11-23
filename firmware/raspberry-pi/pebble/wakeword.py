"""Wake word "Hey Pebbi": listens all the time (offline, Vosk) and starts a conversation.

Vosk runs a small English model restricted to a few phrases, so it is light enough for a Pi 5
and needs no account or internet. People say "เฮ้ เปบบี้" with a Thai accent, which the
English model hears as "hey pebby", "hey peppy", "hey bobby"... all of those count.

The microphone is shared with Voice.listen(): while a conversation runs (or the robot is
speaking) this listener lets go of the microphone and waits.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time

log = logging.getLogger("wake")

RATE = 16000
BLOCK = 4000  # 0.25 s

# what the recogniser may answer; anything else becomes [unk]
PHRASES = ["hey pebby", "hey peppy", "hey pebble", "hey bobby", "hey baby", "hey betty", "pebby", "peppy", "[unk]"]
NAMES = {"pebby", "peppy", "pebble", "bobby", "baby", "betty"}
STRONG = {"pebby", "peppy", "pebble"}  # count even without "hey"

DEFAULT_MODEL = "/opt/pebble/models/vosk-model-small-en-us-0.15"


def heard_wake(text: str) -> bool:
    words = text.lower().split()
    for i, w in enumerate(words):
        if w in STRONG:
            return True
        if w in NAMES and i > 0 and words[i - 1] == "hey":
            return True
    return False


class WakeWord:
    def __init__(self, cfg, busy, on_wake):
        """busy() -> True while the mic is used by a conversation / the robot is talking."""
        self.cfg = cfg
        self.busy = busy
        self.on_wake = on_wake
        self.available = False
        self.error = ""
        self._stop = threading.Event()
        self._model = None
        self._last = 0.0
        if not getattr(cfg, "wake_enabled", True) or not cfg.voice_enabled:
            self.error = "ปิดไว้ในการตั้งค่า"
            return
        path = getattr(cfg, "wake_model", "") or DEFAULT_MODEL
        if not os.path.isdir(path):
            self.error = f"ไม่พบโมเดล {path} (รัน install.sh ใหม่)"
            log.warning("wake word off: model not found at %s", path)
            return
        try:
            import sounddevice as sd
            from vosk import Model, SetLogLevel

            from .voice import has_input
            if not has_input(sd, cfg.input_device):
                self.error = "ยังไม่ได้เสียบไมโครโฟน"
                log.info("wake word waits for a microphone")
                return

            SetLogLevel(-1)
            self._model = Model(path)
            self.available = True
            log.info("wake word ready (%s)", os.path.basename(path))
        except Exception as e:  # vosk not installed, no audio device...
            self.error = str(e)
            log.warning("wake word off: %s", e)

    def start(self):
        if self.available:
            threading.Thread(target=self._run, name="wake", daemon=True).start()

    def stop(self):
        self._stop.set()

    def _run(self):
        import sounddevice as sd
        from vosk import KaldiRecognizer

        dev = self.cfg.input_device
        device = None if dev == "" else int(dev) if dev.isdigit() else dev
        while not self._stop.is_set():
            if self.busy():
                time.sleep(0.3)
                continue
            rec = KaldiRecognizer(self._model, RATE, json.dumps(PHRASES))
            try:
                with sd.RawInputStream(samplerate=RATE, blocksize=BLOCK, dtype="int16", channels=1, device=device) as stream:
                    while not self._stop.is_set() and not self.busy():
                        data, _ = stream.read(BLOCK)
                        if rec.AcceptWaveform(bytes(data)):
                            text = json.loads(rec.Result()).get("text", "")
                        else:
                            text = json.loads(rec.PartialResult()).get("partial", "")
                        if text and heard_wake(text) and time.monotonic() - self._last > 3:
                            self._last = time.monotonic()
                            log.info("wake word: %r", text)
                            rec.Reset()
                            break  # give the microphone to the conversation
                    else:
                        continue
                self.on_wake()
                time.sleep(1.0)  # let the conversation open the mic first
            except Exception as e:
                log.warning("wake listener: %s", e)
                time.sleep(3)
