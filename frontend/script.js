const BASE_URL = "https://ce395backend.loca.lt"; 
const API_URL = `${BASE_URL}/latest`; // สำหรับโหลดข้อมูลเซ็นเซอร์
const ASK_AI_URL = `${BASE_URL}/ask-ai`; // สำหรับถาม AI

// ✅ โหลดข้อมูลเซ็นเซอร์ล่าสุด
async function fetchSensorData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const { light, temp, humidity } = data;

    // แสดงค่าต่าง ๆ
    document.getElementById("light").textContent = light;
    document.getElementById("temp").textContent = temp;
    document.getElementById("humidity").textContent = humidity;
    document.getElementById("light-status").textContent = getLightStatusText(light);
    document.getElementById("temp-status").textContent = getTempStatusText(temp);
    document.getElementById("humidity-status").textContent = getHumidityStatusText(humidity);

    // วันที่และเวลา (แบบไทย)
    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    document.getElementById("datestamp").textContent = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year}`;
    document.getElementById("timestamp").textContent = `${thaiDate.time} น.`;
  } catch (error) {
    console.error("❌ โหลดข้อมูลเซ็นเซอร์ไม่สำเร็จ:", error);
  }
}

// ✅ ถาม AI ผ่าน backend
async function askAI() {
  const question = document.getElementById("user-question").value.trim();
  const answerBox = document.getElementById("ai-answer");

  if (!question) {
    answerBox.textContent = "⚠️ กรุณาพิมพ์คำถามก่อนนะครับ";
    return;
  }

  try {
    answerBox.textContent = "⏳ กำลังถาม AI...";
    const response = await fetch(ASK_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    answerBox.textContent = data.answer || "❌ ไม่มีคำตอบจาก AI";
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    answerBox.textContent = "❌ ไม่สามารถติดต่อ AI ได้";
  }
}

// ✅ แปลสถานะจากค่าเซ็นเซอร์
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
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด 🌧️";
  if (humidity > 70) return "อากาศชื้น เหนียวตัว 💦";
  if (humidity > 60) return "เริ่มชื้น 🌫️";
  if (humidity > 40) return "อากาศสบาย ✅";
  if (humidity > 30) return "ค่อนข้างแห้ง 💨";
  if (humidity > 20) return "แห้งมาก 🥵";
  return "อากาศแห้งมาก 🏜️";
}

// ✅ แปลงวันที่และเวลาเป็นแบบไทย
function getThaiDateParts(date) {
  const optionsDate = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const thDateFormatter = new Intl.DateTimeFormat("th-TH", optionsDate);
  const thTimeFormatter = new Intl.DateTimeFormat("th-TH", optionsTime);
  const parts = thDateFormatter.formatToParts(date);
  const time = thTimeFormatter.format(date);
  return {
    dayOfWeek: parts.find((p) => p.type === "weekday")?.value ?? "",
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: parts.find((p) => p.type === "month")?.value ?? "",
    year: parts.find((p) => p.type === "year")?.value ?? "",
    time,
  };
}

// ✅ เริ่มโหลดเมื่อเปิดหน้า
window.addEventListener("load", () => {
  fetchSensorData();
  setInterval(fetchSensorData, 1000); // โหลดทุก 1 วินาที
});
