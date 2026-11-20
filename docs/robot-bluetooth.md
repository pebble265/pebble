# pebble(a) robot — Bluetooth setup protocol

The app finds a new robot over Bluetooth LE during first-run setup ("Finding Your pebble").
The robot must do the following while it has **no owner**.

## GATT service (advertise this UUID)

| Item    | UUID                                   | Access | Value (UTF-8) |
|---------|----------------------------------------|--------|---------------|
| Service | `b7a1e000-5e6b-4c3a-9f0e-7065626c6561` | —      | advertised in the advertising packet |
| INFO    | `b7a1e001-5e6b-4c3a-9f0e-7065626c6561` | read   | `{"serial":"PBL-B79D3B4E","name":"pebble(a)","model":"A3120B","color":"Space Black","fw":"1.0.0"}` |
| PAIR    | `b7a1e002-5e6b-4c3a-9f0e-7065626c6561` | read   | the current 6-digit pairing code, or `""` while it does not have one yet |

## Robot steps

1. On boot: `POST /robot/auth { serialNumber, secret }` → device token.
2. If not paired: `POST /robot/pairing-code` → `{ code, expiresAt }`. Put `code` in PAIR. Get a new one before it expires.
3. Advertise the service. Device name: `pebble(a)`.
4. The app reads INFO (shows model/colour on "Is This Yours?"), then reads PAIR and calls
   `POST /devices/pair { code, serialNumber }`. The server checks the code belongs to that serial.
5. When `GET /robot/me` succeeds with an owner, stop advertising and clear PAIR.

The code is short-lived and single-use, and the server only accepts it together with the right serial,
so reading it over BLE is no weaker than showing it on screen. Still show the code on the robot's
screen too: the app's "have a trouble with connecting?" link lets people type it in.

## Testing without hardware

`ble/esp32_pebble_ble.ino` is a minimal ESP32 sketch that advertises the service with a fixed
INFO and a PAIR code you paste in from `POST /robot/pairing-code` (Serial Monitor).
With no robot nearby, the app shows a **demo robot** after ~12 s; "Yes, and connected" on the demo
finishes setup without pairing (you can pair later).
