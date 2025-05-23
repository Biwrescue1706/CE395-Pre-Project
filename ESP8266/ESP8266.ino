#include <Wire.h>
#include <BH1750.h>
#include <DHT.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>

// ==== DHT22 ====
#define DHTPIN 14
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// ==== BH1750 ====
BH1750 lightMeter;

// ==== WiFi ====
char ssid[] = "BiwBong";
char pass[] = "17061706";

// ==== Backend URL ====
const char* serverUrl = "https://elvis-clone-draw-specialties.trycloudflare.com/sensor-data";

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("🔌 USB เชื่อมต่อแล้ว");
  Serial.print("📶 กำลังเชื่อมต่อ WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ เชื่อมต่อ WiFi สำเร็จ!");
    Serial.print("📡 IP ที่ได้: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ เชื่อมต่อ WiFi ล้มเหลว");
  }

  Wire.begin(4, 5);  // SDA = GPIO4 (D2), SCL = GPIO5 (D1)
  if (lightMeter.begin()) {
    Serial.println("✅ เริ่มต้น BH1750 สำเร็จ");
  } else {
    Serial.println("❌ เริ่มต้น BH1750 ไม่ได้");
  }

  dht.begin();
  Serial.println("🌡 เริ่มต้นเซนเซอร์ DHT22...");
  Serial.println("---------------------\n");
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("🔄 WiFi หลุด! กำลังเชื่อมต่อใหม่...");
    WiFi.begin(ssid, pass);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n✅ เชื่อมต่อใหม่สำเร็จ!");
      Serial.print("📡 IP ใหม่: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("\n❌ เชื่อมต่อใหม่ไม่สำเร็จ");
    }
  }
}

void loop() {
  checkWiFiConnection();

  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  int light = lightMeter.readLightLevel();

  if (isnan(temp) || isnan(humidity)) {
    Serial.println("❌ การอ่านค่าจาก DHT22 ล้มเหลว");
    return;
  }

  if (isnan(light)) {
    Serial.println("❌ อ่านค่าจาก BH1750 ไม่ได้");
    return;
  }

  Serial.printf("\n🌡 อุณหภูมิ : %.2f °C\n", temp);
  Serial.printf("💧 ความชื้น : %.2f %%\n", humidity);
  Serial.printf("💡 แสงแดด : %d lx\n", light);
  Serial.println("---------------------");

  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); 
    HTTPClient http;
    http.begin(client, serverUrl);
    
    http.addHeader("Content-Type", "application/json");

    String jsonData = "{\"light\": " + String(light) + ",\"temp\": " + String(temp) + ",\"humidity\": " + String(humidity) + "}";
    Serial.print("📤 POST JSON: ");
    Serial.println(jsonData);
    Serial.print("------------------------------------------- \n");

    int httpResponseCode = http.POST(jsonData);

    if (httpResponseCode > 0) {
      Serial.print("✅ ส่งค่า Backend URL : ");
      Serial.print(serverUrl);
      Serial.print(" สำเร็จ");
      Serial.print("\n httpResponseCode ");
      Serial.println(httpResponseCode);
      Serial.println("------------------------------------------- ");
    } else {
      Serial.print("❌ ส่งค่า Backend : ");
      Serial.print(serverUrl);
      Serial.print(" ไม่สำเร็จ");
      Serial.print("\n httpResponseCode ");
      Serial.println(httpResponseCode);
      Serial.println("------------------------------------------- ");
    }

    http.end();
  }

  delay(1500);
}