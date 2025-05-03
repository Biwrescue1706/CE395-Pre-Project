const API_URL = "https://ce395backend.loca.lt/latest"; // ดึงข้อมูลเซ็นเซอร์
const ASK_AI_URL = "https://ce395backend.loca.lt/ask-ai"; // ถาม AI ผ่าน backend

async function fetchSensorData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const { light, temp, humidity } = data;

    document.getElementById("light").textContent = light;
    document.getElementById("temp").textContent = temp;
    document.getElementById("humidity").textContent = humidity;

    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    document.getElementById("datestamp").textContent = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year}`;
    document.getElementById("timestamp").textContent = `${thaiDate.time} น.`;

    document.getElementById("light-status").textContent = getLightStatusText(light);
    document.getElementById("temp-status").textContent = getTempStatusText(temp);
    document.getElementById("humidity-status").textContent = getHumidityStatusText(humidity);

    document.getElementById("ai-suggestion").textContent = getAISuggestion(light, temp, humidity);

    applyStatusColor("light-box", getLightClass(light));
    applyStatusColor("temp-box", getTempClass(temp));
    applyStatusColor("humidity-box", getHumidityClass(humidity));
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
  }
}

function getThaiDateParts(date) {
  const optionsDate = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const thDateFormatter = new Intl.DateTimeFormat("th-TH", optionsDate);
  const thTimeFormatter = new Intl.DateTimeFormat("th-TH", optionsTime);
  const parts = thDateFormatter.formatToParts(date);
  const time = thTimeFormatter.format(date);
  return {
    dayOfWeek: parts.find(p => p.type === "weekday")?.value ?? "",
    day: parts.find(p => p.type === "day")?.value ?? "",
    month: parts.find(p => p.type === "month")?.value ?? "",
    year: parts.find(p => p.type === "year")?.value ?? "",
    time,
  };
}

function getLightStatusText(light) {
  if (light > 50000) return "แดดจ้า ☀️";
  if (light > 10000) return "กลางแจ้ง มีเมฆ หรือแดดอ่อน 🌤";
  if (light > 5000) return "ฟ้าครึ้ม 🌥";
  if (light > 1000) return "ห้องที่มีแสงธรรมชาติ 🌈";
  if (light > 500) return "ออฟฟิศ หรือร้านค้า 💡";
  if (light > 100) return "ห้องนั่งเล่น ไฟบ้าน 🌙";
  if (light > 10) return "ไฟสลัว 🌑";
  return "มืดมากๆ 🕳️";
}

function getTempStatusText(temp) {
  if (temp > 35) return "อุณหภูมิร้อนมาก ⚠️";
  if (temp >= 30) return "อุณหภูมิร้อน 🔥";
  if (temp >= 25) return "อุณหภูมิอุ่นๆ 🌞";
  if (temp >= 20) return "อุณหภูมิพอดี 🌤";
  return "อุณหูมิเย็น ❄️";
}

function getHumidityStatusText(humidity) {
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด เหงื่อไม่ระเหย 🌧️";
  if (humidity > 70) return "อากาศชื้น เหนียวตัว ระบายความร้อนได้ไม่ดี 💦";
  if (humidity > 60) return "เริ่มชื้น อาจรู้สึกอบอ้าวได้เล็กน้อย 🌫️";
  if (humidity > 40) return "อากาศสบาย เหมาะสมที่สุด ✅";
  if (humidity > 30) return "ค่อนข้างแห้ง ผิวเริ่มแห้งได้ 💨";
  if (humidity > 20) return "แห้งมาก ผิวแห้ง ปากแห้ง ระคายจมูก 🥵";
  return "อากาศแห้งมาก 🏜️";
}

function getAISuggestion(light, temp, humidity) {
  if (light < 5000 && humidity > 80) return "🌧️ มีโอกาสฝนตกสูง ควรพกร่มออกไปด้วย!";
  if (temp > 35 && humidity < 50) return "🔥 อากาศร้อนจัด ควรดื่มน้ำและหลีกเลี่ยงแดด!";
  if (temp >= 30 && humidity > 70) return "💦 อากาศร้อนชื้น อาจทำให้เหนียวตัว!";
  if (temp >= 25 && humidity >= 40 && light > 10000) return "🌤 อากาศดี น่าออกไปเดินเล่น!";
  if (temp < 20) return "❄️ อากาศเย็นสบาย ควรใส่เสื้อกันหนาวบางๆ";
  return "✅ อากาศปกติ น่าอยู่สบาย!";
}

function getLightClass(light) {
  if (light > 50000) return "light-very-bright";
  if (light > 10000) return "light-bright";
  if (light > 5000) return "light-cloudy";
  if (light > 1000) return "light-natural";
  if (light > 500) return "light-office";
  if (light > 100) return "light-room";
  if (light > 10) return "light-dim";
  return "light-dark";
}

function getTempClass(temp) {
  if (temp > 30) return "temp-very-hot";
  if (temp > 25) return "temp-hot";
  if (temp > 20) return "temp-warm";
  if (temp > 15) return "temp-cool";
  return "temp-very-cold";
}

function getHumidityClass(humidity) {
  if (humidity > 70) return "humidity-level-7";
  if (humidity > 60) return "humidity-level-6";
  if (humidity > 50) return "humidity-level-5";
  if (humidity > 40) return "humidity-level-4";
  if (humidity > 30) return "humidity-level-3";
  if (humidity > 20) return "humidity-level-2";
  return "humidity-level-1";
}

function applyStatusColor(id, className) {
  const el = document.getElementById(id);
  el.className = "";
  if (className) el.classList.add(className);
}

/* ✅ ฟังก์ชันถาม AI ผ่าน backend */
async function askAI() {
  const question = document.getElementById("user-question").value.trim();
  if (!question) {
    document.getElementById("ai-answer").textContent = "⚠️ กรุณาพิมพ์คำถามก่อนนะครับ";
    return;
  }

  try {
    document.getElementById("ai-answer").textContent = "⏳ กำลังถาม AI...";
    const response = await fetch(ASK_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    const data = await response.json();
    document.getElementById("ai-answer").textContent = data.answer || "❌ ไม่มีคำตอบจาก AI";
  } catch (error) {
    console.error(error);
    document.getElementById("ai-answer").textContent = "❌ ไม่สามารถติดต่อ AI ได้";
  }
}

/* ✅ โหลดข้อมูลทุก 1 วินาที */
fetchSensorData();
setInterval(fetchSensorData, 1000);
