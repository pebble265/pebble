// pebble(a) BLE test robot for ESP32 (Arduino core 3.x, built-in BLE library).
// 1. Provision a robot: apps/api -> node --env-file=.env dist/scripts/provision-device.js
// 2. Get a code: POST /robot/auth, then POST /robot/pairing-code with the device token
// 3. Flash this, open Serial Monitor (115200), type the 6-digit code + Enter.
#include <BLEDevice.h>
#include <BLEServer.h>

#define SERVICE_UUID "b7a1e000-5e6b-4c3a-9f0e-7065626c6561"
#define INFO_UUID    "b7a1e001-5e6b-4c3a-9f0e-7065626c6561"
#define PAIR_UUID    "b7a1e002-5e6b-4c3a-9f0e-7065626c6561"

const char* SERIAL_NUMBER = "PBL-XXXXXXXX";  // from provision-device
BLECharacteristic* pairChar;

void setup() {
  Serial.begin(115200);
  BLEDevice::init("pebble(a)");
  BLEServer* server = BLEDevice::createServer();
  BLEService* service = server->createService(SERVICE_UUID);

  BLECharacteristic* info = service->createCharacteristic(INFO_UUID, BLECharacteristic::PROPERTY_READ);
  String json = String("{\"serial\":\"") + SERIAL_NUMBER +
                "\",\"name\":\"pebble(a)\",\"model\":\"A3120B\",\"color\":\"Space Black\",\"fw\":\"0.1.0\"}";
  info->setValue(json.c_str());

  pairChar = service->createCharacteristic(PAIR_UUID, BLECharacteristic::PROPERTY_READ);
  pairChar->setValue("");

  service->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Advertising. Type the 6-digit pairing code:");
}

void loop() {
  if (Serial.available()) {
    String code = Serial.readStringUntil('\n');
    code.trim();
    if (code.length() == 6) {
      pairChar->setValue(code.c_str());
      Serial.println("PAIR = " + code);
    }
  }
  delay(50);
}
