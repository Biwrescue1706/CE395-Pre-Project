const BASE_URL = "https://elvis-clone-draw-specialties.trycloudflare.com";
const API_URL = `${BASE_URL}/latest`;      // โหลดข้อมูลเซ็นเซอร์
const ASK_AI_URL = `${BASE_URL}/ask-ai`;   // ถาม AI

// โหลดข้อมูลเซ็นเซอร์ล่าสุด
async function fetchSensorData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    const { light, temp, humidity } = data;

    document.getElementById("light").textContent = light;
    document.getElementById("temp").textContent = temp;
    document.getElementById("humidity").textContent = humidity;
    document.getElementById("light-status").textContent = getLightStatusText(light);
    document.getElementById("temp-status").textContent = getTempStatusText(temp);
    document.getElementById("humidity-status").textContent = getHumidityStatusText(humidity);

    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    document.getElementById("datestamp").textContent = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year}`;
    document.getElementById("timestamp").textContent = `${thaiDate.time} น.`;
  } catch (error) {
    console.error("❌ โหลดข้อมูลเซ็นเซอร์ไม่สำเร็จ:", error);
  }
}

// ถาม AI ผ่าน backend
async function askAI() {
  const input = document.getElementById("user-question");
  const question = input.value.trim();
  const answerBox = document.getElementById("ai-answer");
  if (!question) {
    answerBox.textContent = "⚠️ กรุณาพิมพ์คำถามก่อนนะครับ";
    return;
  }

  try {
    answerBox.innerHTML = `
    <p>คำถาม : ${question} </p>
    <p>กำลังถาม AI... </p>`;

    const response = await fetch(ASK_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();
    const aiAnswer = data.answer ?? "❌ ไม่มีคำตอบจาก AI";

    answerBox.innerHTML = `  
    <p>คำถาม : ${question}</p>
    <p>คำตอบ ของ AI : ${aiAnswer}</p>
    `;
    input.value = "";
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    answerBox.textContent = "❌ ไม่สามารถติดต่อ AI ได้";
  }
}

// แปลสถานะจากค่าเซ็นเซอร์
function getLightStatusText(light) {
  if (light > 50000) return "สว่างจัดมาก";
  if (light > 10000) return "สว่างมาก";
  if (light > 5000) return "สว่างปานกลาง";
  if (light > 1000) return "ค่อนข้างสว่าง";
  if (light > 500) return "แสงพอใช้";
  if (light > 100) return "แสงน้อย";
  if (light > 10) return "มืดสลัว";
  return "มืดมาก";
}

function getTempStatusText(temp) {
  if (temp > 35) return "อุณหภูมิร้อนมาก";
  if (temp >= 30) return "อุณหภูมิร้อน";
  if (temp >= 25) return "อุณหภูมิอุ่นๆ";
  if (temp >= 20) return "อุณหภูมิพอดี";
  return "อุณหูมิเย็น";
}

function getHumidityStatusText(humidity) {
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด";
  if (humidity > 70) return "อากาศชื้น เหนียวตัว";
  if (humidity > 60) return "เริ่มชื้น";
  if (humidity > 40) return "อากาศสบาย";
  if (humidity > 30) return "ค่อนข้างแห้ง";
  if (humidity > 20) return "แห้งมาก";
  return "อากาศแห้งมาก 🏜️";
}

// แปลงวันที่และเวลาเป็นแบบไทย
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

// เริ่มโหลดเมื่อเปิดหน้า
window.addEventListener("load", () => {
  fetchSensorData();
  setInterval(fetchSensorData, 500); // โหลดทุก 0.5 วินาที
});
