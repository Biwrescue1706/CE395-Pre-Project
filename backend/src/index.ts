require("dotenv").config();
import express, { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

const LINE_ACCESS_TOKEN: string = process.env.LINE_ACCESS_TOKEN || "";
const LINE_GROUP_ID: string = process.env.LINE_GROUP_ID || "";
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || "";

app.use(cors());
app.use(bodyParser.json());

// เก็บข้อมูลเซ็นเซอร์ล่าสุด
let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

// ✅ แปลงวัน/เวลาเป็นภาษาไทย
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

    return {
        dayOfWeek: parts.find(p => p.type === "weekday")?.value ?? "",
        day: parts.find(p => p.type === "day")?.value ?? "",
        month: parts.find(p => p.type === "month")?.value ?? "",
        year: parts.find(p => p.type === "year")?.value ?? "",
        time,
    };
}

// ✅ ส่งแจ้งเตือน LINE OA
async function sendLineNotification(light: number, temp: number, humidity: number): Promise<void> {
    let lightStatus = "";
    let tempStatus = "";
    let humidityStatus = "";

    // แปลค่าแสง
    if (light > 50000) lightStatus = "แดดจ้า ☀️";
    else if (light > 10000) lightStatus = "กลางแจ้ง มีเมฆ หรือแดดอ่อน 🌤";
    else if (light > 5000) lightStatus = "ฟ้าครึ้ม 🌥";
    else if (light > 1000) lightStatus = "ห้องที่มีแสงธรรมชาติ 🌈";
    else if (light > 500) lightStatus = "ออฟฟิศ หรือร้านค้า 💡";
    else if (light > 100) lightStatus = "ห้องนั่งเล่น ไฟบ้าน 🌙";
    else if (light > 10) lightStatus = "ไฟสลัว 🌑";
    else lightStatus = "มืดมากๆ 🕳️";

    // แปลค่าอุณหภูมิ
    if (temp > 35) tempStatus = "อุณหภูมิร้อนมาก ⚠️";
    else if (temp >= 30) tempStatus = "อุณหภูมิร้อน 🔥";
    else if (temp >= 25) tempStatus = "อุณหภูมิอุ่นๆ 🌞";
    else if (temp >= 20) tempStatus = "อุณหภูมิพอดี 🌤";
    else tempStatus = "อุณหูมิเย็น ❄️";

    // แปลค่าความชื้น
    if (humidity > 85) humidityStatus = "ชื้นมาก อากาศอึดอัด เหงื่อไม่ระเหย 🌧️";
    else if (humidity > 70) humidityStatus = "อากาศชื้น เหนียวตัว ระบายความร้อนได้ไม่ดี 💦";
    else if (humidity > 60) humidityStatus = "เริ่มชื้น อาจรู้สึกอบอ้าวได้เล็กน้อย 🌫️";
    else if (humidity > 40) humidityStatus = "อากาศสบาย เหมาะสมที่สุด ✅";
    else if (humidity > 30) humidityStatus = "ค่อนข้างแห้ง ผิวเริ่มแห้งได้ 💨";
    else if (humidity > 20) humidityStatus = "แห้งมาก ผิวแห้ง ปากแห้ง ระคายจมูก 🥵";
    else humidityStatus = "อากาศแห้งมาก 🏜️";

    const now = new Date();
    const thaiDate = getThaiDateParts(now);
    const fullDateTime = `${thaiDate.dayOfWeek}ที่ ${thaiDate.day} ${thaiDate.month} พ.ศ. ${thaiDate.year}`;

    const message = `⚠ แจ้งเตือน! ⚠
📅 วัน : ${fullDateTime}
⏰ เวลา ${thaiDate.time} น.
☀ แสงแดด : ${light} lux (${lightStatus})
🌡 อุณหภูมิ : ${temp} °C (${tempStatus})
💧 ความชื้น : ${humidity} % (${humidityStatus})`;

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

// ตรวจสอบแจ้งเตือนทุก 5 นาที
let lastAlertTime = 0;
const ALERT_INTERVAL = 5*60*1000 ; // 5 นาที

async function checkAndSendAlert() {
    const currentTime = new Date().getTime();
    if (currentTime - lastAlertTime >= ALERT_INTERVAL && lastSensorData) {
        const { light, temp, humidity } = lastSensorData;
        await sendLineNotification(light, temp, humidity);
        lastAlertTime = currentTime;
    }
}
setInterval(checkAndSendAlert, 60 * 1000); // ตรวจสอบทุก 1 นาที

// ✅ [POST] รับข้อมูลจาก ESP32
app.post("/sensor-data", (req: Request, res: Response) => {
    const { light, temp, humidity }: { light: number; temp: number; humidity: number } = req.body;
    if (light !== undefined && temp !== undefined && humidity !== undefined) {
        lastSensorData = { light, temp, humidity };
        res.json({ message: "✅ รับข้อมูลแล้ว!" });
    } else {
        res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
});

// ✅ [GET] ดึงข้อมูลล่าสุด
app.get("/latest", (req: Request, res: Response) => {
    if (lastSensorData) {
        res.json(lastSensorData);
    } else {
        res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
    }
});

// ✅ [POST] ถาม AI ผ่าน OpenAI API
app.post("/ask-ai", async (req: Request, res: Response): Promise<void> => {
    const { question } = req.body;

    if (!lastSensorData) {
        res.status(400).json({ error: "❌ ไม่มีข้อมูลเซ็นเซอร์ล่าสุด" });
        return
    }

    const { light, temp, humidity } = lastSensorData;

    const systemPrompt = `
    คุณเป็นผู้ช่วยวิเคราะห์สภาพอากาศจากข้อมูลเซ็นเซอร์ IoT
    ข้อมูลปัจจุบัน:
    - แสง: ${light} lux
    - อุณหภูมิ: ${temp} °C
    - ความชื้น: ${humidity} %
    ให้ตอบสั้นๆ เป็นภาษาไทย
    `;

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question }
                ],
                temperature: 0.7,
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const answer = response.data.choices?.[0]?.message?.content || "❌ ไม่สามารถตอบได้";
        res.json({ answer });

    } catch (error: any) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: "❌ ขออภัย, เกิดข้อผิดพลาดในการเชื่อมต่อ OpenAI" });
    }
});

// ✅ เริ่มรันเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
