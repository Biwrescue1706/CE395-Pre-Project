require("dotenv").config();
import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const LINE_ACCESS_TOKEN: string = process.env.LINE_ACCESS_TOKEN || "";
const LINE_GROUP_ID: string = process.env.LINE_GROUP_ID || "";

// เก็บข้อมูลเซ็นเซอร์ล่าสุด
let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

// ✅ ฟังก์ชันแปลงวัน/เวลาเป็นภาษาไทย
function getThaiDateParts(date: Date) {
    const optionsDate: Intl.DateTimeFormatOptions = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    };

    const optionsTime: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
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

// ✅ ฟังก์ชันส่งข้อความ LINE
async function sendLineNotification(light: number, temp: number, humidity: number): Promise<void> {
    let lightStatus = "";
    let tempStatus = "";
    let humidityStatus = "";


    // แปลค่าความสว่าง
    if (light > 65535) lightStatus = "แสงแดดจ้ามากๆ 🌞";
    else if (light > 60000) lightStatus = "แสงสว่างมาก ☀️";
    else if (light > 40000) lightStatus = "แดดแรงกลางแจ้ง 🌤";
    else if (light > 30000) lightStatus = "แดดอ่อนหรือมีเมฆ 🌥";
    else if (light > 20000) lightStatus = "ฟ้าครึ้มใกล้ฝน 🌦";
    else if (light > 15000) lightStatus = "แสงธรรมชาติเยอะในร่ม 🌈";
    else if (light > 10000) lightStatus = "แสงจากหลอดไฟขนาดใหญ่ 💡";
    else if (light > 7000) lightStatus = "แสงในห้องสว่างมาก 💡";
    else if (light > 4000) lightStatus = "ไฟสว่างทั่วไป 💡";
    else if (light > 2000) lightStatus = "ห้องมีแสงไฟอ่อนๆ 🌙";
    else if (light > 1000) lightStatus = "เริ่มมืดลง 🌌";
    else if (light > 500) lightStatus = "แสงสลัว 🌑";
    else if (light > 100) lightStatus = "มืดมาก ต้องเพ่งมอง 🔦";
    else if (light > 10) lightStatus = "มืดเกือบสนิท 🕳️";
    else lightStatus = "มืดสนิท ⚫";

    // แปลค่าอุณหภูมิ
    if (temp > 35) tempStatus = "อุณหภูมิร้อนมาก ⚠️";
    else if (temp >= 30) tempStatus = "อุณหภูมิร้อน 🔥";
    else if (temp >= 25) tempStatus = "อุณหภูมิอุ่นๆ 🌞";
    else if (temp >= 20) tempStatus = "อุณหภูมิพอดี 🌤";
    else tempStatus = "อุณหูมิเย็น ❄️";

    // แปลค่าความชื้น
    if (humidity > 85) humidityStatus = " ชื้นมาก อากาศอึดอัด เหงื่อไม่ระเหย 🌧️ ";
    else if (humidity > 70) humidityStatus = " อากาศชื้น เหนียวตัว ระบายความร้อนได้ไม่ดี 💦 ";
    else if (humidity > 60) humidityStatus = " เริ่มชื้น อาจรู้สึกอบอ้าวได้เล็กน้อย 🌫️ ";
    else if (humidity > 40) humidityStatus = " อากาศสบาย เหมาะสมที่สุด ✅ ";
    else if (humidity > 30) humidityStatus = " ค่อนข้างแห้ง ผิวเริ่มแห้งได้ 💨 ";
    else if (humidity > 20) humidityStatus = " แห้งมาก ผิวแห้ง ปากแห้ง ระคายจมูก 🥵 ";
    else humidityStatus = "อากาศแห้งมาก 🏜️";

    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    const fullDateTime = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year} `;

    const message = `⚠ แจ้งเตือน! ⚠
📅 วัน : ${fullDateTime}
⏰ เวลา ${thaiDate.time} น.
☀ แสงแดด : ${light}  lux  (${lightStatus})
🌡 อุณหภูมิ : ${temp}  °C  (${tempStatus})
💧 ความชื้น : ${humidity} %  (${humidityStatus})`;

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
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        console.error("❌ แจ้งเตือนล้มเหลว:", axiosError.response?.data || axiosError.message);
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

// ✅ รับข้อมูลจาก ESP8266
app.post("/sensor-data", async (req: Request, res: Response) => {
    const { light, temp, humidity }: { light: number; temp: number; humidity: number } = req.body;

    if (light !== undefined && temp !== undefined && humidity !== undefined) {
        lastSensorData = { light, temp, humidity };
        res.json({ message: "✅ รับข้อมูลแล้ว!" });
    } else {
        res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
});

// ✅ ดึงข้อมูลล่าสุด
app.get("/latest", (req: Request, res: Response) => {
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
