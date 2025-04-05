require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";
const LINE_GROUP_ID = process.env.LINE_GROUP_ID || "";

// เก็บข้อมูลเซ็นเซอร์ล่าสุด
let lastSensorData = null;

// ✅ ฟังก์ชันแปลงวัน/เวลาเป็นภาษาไทย
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
        hour12: false,
    };

    const thDateFormatter = new Intl.DateTimeFormat("th-TH", optionsDate);
    const thTimeFormatter = new Intl.DateTimeFormat("th-TH", optionsTime);

    const parts = thDateFormatter.formatToParts(date);
    const time = thTimeFormatter.format(date);

    const dayOfWeek = parts.find(p => p.type === "weekday")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const year = parts.find(p => p.type === "year")?.value || "";

    return {
        dayOfWeek,
        day,
        month,
        year,
        time
    };
}

// ✅ ฟังก์ชันส่งข้อความ LINE
async function sendLineNotification(light, temp, humidity) {
    let lightStatus = "";
    let tempStatus = "";
    let humidityStatus = "";

    // แปลค่าความสว่าง
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
    if (temp > 35) tempStatus = "อุณหภูมิสูงมาก ⚠️";
    else if (temp >= 30) tempStatus = "อุณหภูมิร้อน 🔥";
    else if (temp >= 25) tempStatus = "อุณหภูมิอุ่นๆ 🌞";
    else if (temp >= 20) tempStatus = "อุณหภูมิพอดี 🌤";
    else tempStatus = "อุณหูมิเย็น ❄️";

    // แปลค่าความชื้น
    if (humidity > 80) humidityStatus = "ความชื้นสูงมาก 💦";
    else if (humidity > 60) humidityStatus = "ความชื้นสูง 🌧️";
    else if (humidity > 30) humidityStatus = "ความชื้นปกติ 🌤️";
    else if (humidity > 20) humidityStatus = "ความชื้นต่ำ 🌵";
    else humidityStatus = "อากาศแห้งมาก 🏜️";

    // ✅ ตรวจว่าฝนอาจจะตกหรือไม่
    let rainForecastStatus;
    if (humidity >= 80 && temp >= 24 && temp <= 32) {
        rainForecastStatus = "🌧️ มีโอกาสฝนตก";
    } else {
        rainForecastStatus = "☀️ ไม่มีแนวโน้มฝนตก";
    }

    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    const fullDateTime = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year} เวลา ${thaiDate.time} น.`;

    const message = `⚠ แจ้งเตือน! ⚠
📅 วันที่: ${fullDateTime}
☀ แสงแดด: ${light} lux (${lightStatus})
🌡 อุณหภูมิ: ${temp} °C (${tempStatus})
💧 ความชื้น: ${humidity} % (${humidityStatus})
🌧️ สภาพอากาศ: ${rainForecastStatus}`;

    try {
        const response = await axios.post(
            "https://api.line.me/v2/bot/message/push",
            {
                to: LINE_GROUP_ID,
                messages: [{ type: "text", text: message }],
            },
            {
                headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
            }
        );
        console.log("✅ ส่งข้อความแจ้งเตือนสำเร็จ!", response.data);
    } catch (error) {
        console.error("❌ แจ้งเตือนล้มเหลว:", error.response?.data || error.message);
    }
}

let lastAlertTime = 0;
const ALERT_INTERVAL = 5 * 60 * 1000; // 5 นาที

// ✅ ตรวจสอบและส่งแจ้งเตือนทุก 5 นาที
async function checkAndSendAlert() {
    const currentTime = new Date().getTime();
    if (currentTime - lastAlertTime >= ALERT_INTERVAL) {
        if (lastSensorData) {
            const { light, temp, humidity } = lastSensorData;
            await sendLineNotification(light, temp, humidity);
            lastAlertTime = currentTime;
        }
    }
}

setInterval(checkAndSendAlert, ALERT_INTERVAL);

// ✅ รับข้อมูลจาก ESP32
app.post("/sensor-data", async (req, res) => {
    const { light, temp, humidity } = req.body;

    if (light !== undefined && temp !== undefined && humidity !== undefined) {
        lastSensorData = { light, temp, humidity };
        res.json({ message: "✅ รับข้อมูลแล้ว!" });
    } else {
        res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
});

// ✅ ดึงข้อมูลล่าสุด
app.get("/latest", (req, res) => {
    if (lastSensorData) {
        res.json(lastSensorData);
    } else {
        res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
    }
});

// ✅ เริ่มรันเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
