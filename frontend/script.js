const BASE_URL = "https://habitat-laugh-ridge-one.trycloudflare.com";
const API_URL = `${BASE_URL}/latest`;
const ASK_AI_URL = `${BASE_URL}/ask-ai`;

const lightEl = document.getElementById("light");
const tempEl = document.getElementById("temp");
const humidityEl = document.getElementById("humidity");

const lightStatus = document.getElementById("light-status");
const tempStatus = document.getElementById("temp-status");
const humidityStatus = document.getElementById("humidity-status");

const datestamp = document.getElementById("datestamp");
const timestamp = document.getElementById("timestamp");

const chatBox = document.getElementById("chat-messages");
const input = document.getElementById("user-question");

// โหลดข้อมูลเซ็นเซอร์ทุก 0.5 วินาที
async function fetchSensorData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const { light, temp, humidity } = data;

    lightEl.textContent = `${light}`;
    tempEl.textContent = `${temp}`;
    humidityEl.textContent = `${humidity}`;

    lightStatus.textContent = getLightStatusText(light);
    tempStatus.textContent = getTempStatusText(temp);
    humidityStatus.textContent = getHumidityStatusText(humidity);

    const now = new Date();
    const thai = getThaiDateParts(now);
    datestamp.textContent = `${thai.dayOfWeek}ที่ ${thai.day} ${thai.month} พ.ศ. ${thai.year}`;
    timestamp.textContent = `${thai.time} น.`;
  } catch (err) {
    console.error("โหลดข้อมูลไม่สำเร็จ:", err);
  }
}

// ฟังก์ชันแปลสถานะ
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
  return "อากาศแห้งมาก";
}

function getThaiDateParts(date) {
  const optionsDate = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const optionsTime = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const thDate = new Intl.DateTimeFormat("th-TH", optionsDate).formatToParts(date);
  const thTime = new Intl.DateTimeFormat("th-TH", optionsTime).format(date);
  return {
    dayOfWeek: thDate.find((p) => p.type === "weekday")?.value ?? "",
    day: thDate.find((p) => p.type === "day")?.value ?? "",
    month: thDate.find((p) => p.type === "month")?.value ?? "",
    year: thDate.find((p) => p.type === "year")?.value ?? "",
    time: thTime,
  };
}

// ฟังก์ชันถาม AI
async function askAI() {
  const question = input.value.trim();
  if (!question) return;

  addMessage(question, "คุณ");
  input.value = "";

  try {
    const res = await fetch(ASK_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    const answer = data.answer || "❌ ไม่สามารถติดต่อ AI ได้";
    addMessage(answer, "AI");
  } catch (err) {
    console.error("ถาม AI ผิดพลาด:", err);
    addMessage("❌ ไม่สามารถติดต่อ AI ได้", "AI");
  }
}

// ฟังก์ชันเพิ่มข้อความลงกล่องแชท
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.className = "message";

  const name = document.createElement("div");
  name.className = "sender";
  name.textContent = sender === "คุณ" ? "คุณ: " : "🤖AI:";

  const msg = document.createElement("div");
  msg.className = sender === "คุณ" ? "question" : "answer";
  msg.textContent = text;

  div.appendChild(name);
  div.appendChild(msg);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// โหลดข้อมูลเมื่อเปิดหน้า
window.addEventListener("load", () => {
  fetchSensorData();
  setInterval(fetchSensorData, 500);
});