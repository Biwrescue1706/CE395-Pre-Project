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

// ฟังก์ชันส่ง Line แจ้งเตือน
async function sendLineNotification(light: number, temp: number, humidity: number): Promise<void> {
    let lightStatus = "";
    let tempStatus = "";
    let humidityStatus = "";

    // ✅ ตรวจสอบค่าแสง
    if (light > 65535) {
        lightStatus = "แสงจ้ามากๆ 🌞";
    } else if (light > 20000) {
        lightStatus = "แสงจ้า 🌞";
    } else if (light > 5000) {
        lightStatus = "แสงสว่างมาก ☀️";
    } else if (light > 1000) {
        lightStatus = "แสงปานกลาง 🌤";
    } else if (light > 50) {
        lightStatus = "แสงน้อย ⛅";
    } else if (light > 20) {
        lightStatus = "แสงมืด 🌑";
    } else if (light > 10) {
        lightStatus = "มืดมาก 🌑";
    } else if (light > 5) {
        lightStatus = "มืดมากๆ 🌑";
    } else {
        lightStatus = "มืดสนิท";
    }

    // 📌 ตรวจสอบค่าอุณหภูมิ (°C)
    if (temp > 35) {
        tempStatus = "อุณหภูมิสูงมาก ⚠️";
    } else if (temp >= 30) {
        tempStatus = "อุณหภูมิร้อน 🔥";
    } else if (temp >= 25) {
        tempStatus = "อุณหภูมิอุ่นๆ 🌞";
    } else if (temp >= 20) {
        tempStatus = "อุณหภูมิพอดี 🌤";
    } else {
        tempStatus = "อุณหูมิเย็น ❄️";
    }

    // 📌 ตรวจสอบค่าความชื้น (%RH)
    if (humidity > 80) {
        humidityStatus = "ความชื้นสูงมาก 💦";
    } else if (humidity > 60) {
        humidityStatus = "ความชื้นสูง 🌧️";
    } else if (humidity > 30) {
        humidityStatus = "ความชื้นปกติ 🌤️";
    } else if (humidity > 20) {
        humidityStatus = "ความชื้นต่ำ 🌵";
    } else {
        humidityStatus = "อากาศแห้งมาก 🏜️";
    }

    const message = `⚠ แจ้งเตือน! ⚠
📅 วันที่: ${new Date().toLocaleString()} น.
☀ แสงแดด: ${light} lux (${lightStatus})
🌡 อุณหภูมิ: ${temp}°C (${tempStatus})
💧 ความชื้น: ${humidity}% (${humidityStatus})`;

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

let lastSensorData = {
    light: 350,
    temp: 26,
    humidity: 50,
};

let lastAlertTime = 0;
const ALERT_INTERVAL = 5 * 60 * 1000; // 5 นาที = 300,000 มิลลิวินาที

// ฟังก์ชันตรวจสอบและส่งแจ้งเตือนทุก 5 นาที
async function checkAndSendAlert() {
    const currentTime = new Date().getTime();
    if (currentTime - lastAlertTime >= ALERT_INTERVAL) {
        // ตรวจสอบว่าเวลาผ่านไปแล้วเกิน 5 นาที
        const { light, temp, humidity } = lastSensorData;
        await sendLineNotification(light, temp, humidity); // ส่งการแจ้งเตือน
        lastAlertTime = currentTime; // อัปเดตเวลาแจ้งเตือนล่าสุด
    }
}

// ใช้ setInterval ตรวจสอบและส่งแจ้งเตือนทุก ๆ 5 นาที
setInterval(checkAndSendAlert, ALERT_INTERVAL);

// ✅ Route รับค่าจาก ESP32
app.post("/sensor-data", async (req: Request, res: Response) => {
    const { light, temp, humidity }: { light: number; temp: number; humidity: number } = req.body;

    if (light !== undefined && temp !== undefined && humidity !== undefined) {
        lastSensorData = { light, temp, humidity };
        res.json({ message: "✅ รับข้อมูลแล้ว!" });
    } else {
        res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
});

// ✅ เพิ่ม route สำหรับหน้าเว็บ
app.get("/latest", (req: Request, res: Response) => {
    res.json(lastSensorData);
});

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
});
