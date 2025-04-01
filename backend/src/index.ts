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
    if (light > 5000) {
        lightStatus = "แสงสูง ☀️";
    } else if (light < 1000) {
        lightStatus = "แสงต่ำ 🌑";
    } else {
        lightStatus = "แสงปกติ 🌤";
    }

    // ✅ ตรวจสอบค่าอุณหภูมิ
    if (temp > 35) {
        tempStatus = "อุณหภูมิสูง (อากาศร้อน) 🔥";
    } else if (temp < 20) {
        tempStatus = "อุณหภูมิต่ำ ❄️";
    } else {
        tempStatus = "อุณหภูมิปกติ 🌡";
    }

    // ✅ ตรวจสอบค่าความชื้น
    if (humidity > 80) {
        humidityStatus = "ความชื้นสูง อาจมีฝนตก 🌧";
    } else if (humidity < 30) {
        humidityStatus = "ความชื้นต่ำ 💨";
    } else {
        humidityStatus = "ความชื้นปกติ 💧";
    }

    const message = `⚠ แจ้งเตือน! ⚠
📅 วันที่: ${new Date().toLocaleString()} น.
☀ แสงแดด: ${light} lux (${lightStatus})
🌡 อุณหภูมิ: ${temp}°C (${tempStatus})
💧 ความชื้น: ${humidity}% (${humidityStatus})`;

    try {
        await axios.post("https://api.line.me/v2/bot/message/push", {
            to: LINE_GROUP_ID,
            messages: [{ type: "text", text: message }]
        }, { headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` } });

        console.log("✅ ส่งข้อความแจ้งเตือนสำเร็จ!");
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        console.error("❌ แจ้งเตือนล้มเหลว:", axiosError.response?.data || axiosError.message);
    }
}

let lastSensorData = {
    light: 0,
    temp: 0,
    humidity: 0
  };
  
  let lastAlertTime = 0;
  const ALERT_INTERVAL = 60 * 1000; // แจ้งเตือนห่างกันอย่างน้อย 1 ชั่วโมง
  
  // ✅ Route รับค่าจาก ESP32
  app.post("/sensor-data", async (req: Request, res: Response) => {
    const { light, temp, humidity }: { light: number; temp: number; humidity: number } = req.body;
  
    if (light !== undefined && temp !== undefined && humidity !== undefined) {
      lastSensorData = { light, temp, humidity };
  
      const now = Date.now();
  
      // 🔍 กำหนดเงื่อนไขการแจ้งเตือน
      const isTempHigh = temp > 35;
      const isHumidityHigh = humidity > 80;
      const isLightLow = light < 100;
  
      const shouldAlert = isTempHigh || isHumidityHigh || isLightLow;
  
      if (shouldAlert && now - lastAlertTime > ALERT_INTERVAL) {
        await sendLineNotification(light, temp, humidity);
        lastAlertTime = now;
      }
  
      res.json({ message: "✅ รับข้อมูลแล้ว!" });
    } else {
      res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
  });
  

//✅ เพิ่ม route สำหรับหน้าเว็บ
app.get("/latest", (req: Request, res: Response) => {
    res.json(lastSensorData);
  });

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`Server runnig on port http://localhost:${PORT}`);
  });