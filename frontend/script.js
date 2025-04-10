const API_URL = "http://localhost:3000/latest";

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
    document.getElementById("timestamp").textContent = `เวลา : ${thaiDate.time} น.`;

    document.getElementById("light-status").textContent = getLightStatusText(light);
    document.getElementById("temp-status").textContent = getTempStatusText(temp);
    document.getElementById("humidity-status").textContent = getHumidityStatusText(humidity);

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
  if (light > 65535) return "แสงแดดจ้ามากๆ 🌞";
  else if (light > 60000) return "แสงสว่างมาก ☀️";
  else if (light > 40000) return "แดดแรงกลางแจ้ง 🌤";
  else if (light > 30000) return "แดดอ่อนหรือมีเมฆ 🌥";
  else if (light > 20000) return "ฟ้าครึ้มใกล้ฝน 🌦";
  else if (light > 15000) return "แสงธรรมชาติเยอะในร่ม 🌈";
  else if (light > 10000) return "แสงจากหลอดไฟขนาดใหญ่ 💡";
  else if (light > 7000) return "แสงในห้องสว่างมาก 💡";
  else if (light > 4000) return "ไฟสว่างทั่วไป 💡";
  else if (light > 2000) return "ห้องมีแสงไฟอ่อนๆ 🌙";
  else if (light > 1000) return "เริ่มมืดลง 🌌";
  else if (light > 500) return "แสงสลัว 🌑";
  else if (light > 100) return "มืดมาก ต้องเพ่งมอง 🔦";
  else if (light > 10) return "มืดเกือบสนิท 🕳️";
  else return "มืดสนิท ⚫";
}

function getTempStatusText(temp) {
  if (temp > 35) return "อุณหภูมิสูงมาก ⚠️";
  else if (temp >= 30) return "อุณหภูมิร้อน 🔥";
  else if (temp >= 25) return "อุณหภูมิอุ่นๆ 🌞";
  else if (temp >= 20) return "อุณหภูมิพอดี 🌤";
  else return "อุณหูมิเย็น ❄️";
}

function getHumidityStatusText(humidity) {
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด เหงื่อไม่ระเหย 🌧️";
  else if (humidity > 70) return "อากาศชื้น เหนียวตัว ระบายความร้อนได้ไม่ดี 💦";
  else if (humidity > 60) return "เริ่มชื้น อาจรู้สึกอบอ้าวได้เล็กน้อย 🌫️";
  else if (humidity > 40) return "อากาศสบาย เหมาะสมที่สุด ✅";
  else if (humidity > 30) return "ค่อนข้างแห้ง ผิวเริ่มแห้งได้ 💨";
  else if (humidity > 20) return "แห้งมาก ผิวแห้ง ปากแห้ง ระคายจมูก 🥵";
  else return "อากาศแห้งมาก 🏜️";
}

function getLightClass(light) {
  if (light > 60000) return "light-level-15";
  if (light > 55000) return "light-level-14";
  if (light > 50000) return "light-level-13";
  if (light > 45000) return "light-level-12";
  if (light > 40000) return "light-level-11";
  if (light > 35000) return "light-level-10";
  if (light > 30000) return "light-level-9";
  if (light > 25000) return "light-level-8";
  if (light > 20000) return "light-level-7";
  if (light > 15000) return "light-level-6";
  if (light > 10000) return "light-level-5";
  if (light > 5000) return "light-level-4";
  if (light > 2000) return "light-level-3";
  if (light > 500) return "light-level-2";
  return "light-level-1";
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

fetchSensorData();
setInterval(fetchSensorData, 1000);
