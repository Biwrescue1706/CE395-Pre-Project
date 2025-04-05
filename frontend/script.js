const API_URL = "http://localhost:3000/latest";

// โหลดข้อมูลจาก Backend
async function fetchSensorData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    console.log(data);

    const light = data.light;
    const temp = data.temp;
    const humidity = data.humidity;

    // แสดงค่าดิบ
    document.getElementById("light").textContent = light;
    document.getElementById("temp").textContent = temp;
    document.getElementById("humidity").textContent = humidity;

    // แสดงวันที่แบบไทย
    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    const fullDateTime = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year} เวลา ${thaiDate.time} น.`;
    document.getElementById("timestamp").textContent = fullDateTime;

    // แปลค่าความสว่าง
    let lightStatus;
    if (light > 65535) lightStatus = "แสงจ้ามากๆ 🌞";
    else if (light > 20000) lightStatus = "แสงจ้า 🌞";
    else if (light > 5000) lightStatus = "แสงสว่างมาก ☀️";
    else if (light > 1000) lightStatus = "แสงปานกลาง 🌤";
    else if (light > 50) lightStatus = "แสงน้อย ⛅";
    else if (light > 20) lightStatus = "แสงมืด 🌑";
    else if (light > 10) lightStatus = "มืดมาก 🌑";
    else if (light > 5) lightStatus = "มืดมากๆ 🌑";
    else lightStatus = "มืดสนิท";

    // แปลค่าอุณหภูมิ
    let tempStatus;
    if (temp > 35) tempStatus = "อุณหภูมิสูงมาก ⚠️";
    else if (temp >= 30) tempStatus = "อุณหภูมิร้อน 🔥";
    else if (temp >= 25) tempStatus = "อุณหภูมิอุ่นๆ 🌞";
    else if (temp >= 20) tempStatus = "อุณหภูมิพอดี 🌤";
    else tempStatus = "อุณหูมิเย็น ❄️";

    // แปลค่าความชื้น
    let humidityStatus;
    if (humidity > 80) humidityStatus = "ความชื้นสูงมาก 💦";
    else if (humidity > 60) humidityStatus = "ความชื้นสูง 🌧️";
    else if (humidity > 30) humidityStatus = "ความชื้นปกติ 🌤️";
    else if (humidity > 20) humidityStatus = "ความชื้นต่ำ 🌵";
    else humidityStatus = "อากาศแห้งมาก 🏜️";

    // พยากรณ์ฝน
    let rainForecastStatus;
    if (humidity >= 80 && temp >= 24 && temp <= 32) {
      rainForecastStatus = "🌧️ มีโอกาสฝนตก";
    } else {
      rainForecastStatus = "☀️ ไม่มีแนวโน้มฝนตก";
    }

    // แสดงผลข้อความแปล
    document.getElementById("light-status").textContent = lightStatus;
    document.getElementById("temp-status").textContent = tempStatus;
    document.getElementById("humidity-status").textContent = humidityStatus;
    document.getElementById("rain-forecast").textContent = rainForecastStatus;

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
  }
}

// แปลงวันที่เป็นภาษาไทย
function getThaiDateParts(date) {
  const optionsDate = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  const optionsTime = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const thDateFormatter = new Intl.DateTimeFormat("th-TH", optionsDate);
  const thTimeFormatter = new Intl.DateTimeFormat("th-TH", optionsTime);

  const parts = thDateFormatter.formatToParts(date);
  const time = thTimeFormatter.format(date);

  const dayOfWeek = parts.find(p => p.type === "weekday")?.value ?? "";
  const day = parts.find(p => p.type === "day")?.value ?? "";
  const month = parts.find(p => p.type === "month")?.value ?? "";
  const year = parts.find(p => p.type === "year")?.value ?? "";

  return {
    dayOfWeek,
    day,
    month,
    year,
    time
  };
}

// โหลดข้อมูลครั้งแรก
fetchSensorData();
// รีเฟรชข้อมูลทุก 1 วินาที
setInterval(fetchSensorData, 1000);
