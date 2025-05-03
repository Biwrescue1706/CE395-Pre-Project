require("dotenv").config();

import express, { Request, Response } from "express";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";
const LINE_GROUP_ID = process.env.LINE_GROUP_ID || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

app.use(cors());
app.use(bodyParser.json());

let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

// ===== Helper =====
function getLightStatus(light: number): string {
  if (light > 50000) return "แดดจ้า ☀️";
  if (light > 10000) return "กลางแจ้ง มีเมฆ หรือแดดอ่อน 🌤";
  if (light > 5000) return "ฟ้าครึ้ม 🌥";
  if (light > 1000) return "ห้องที่มีแสงธรรมชาติ 🌈";
  if (light > 500) return "ออฟฟิศ หรือร้านค้า 💡";
  if (light > 100) return "ห้องนั่งเล่น ไฟบ้าน 🌙";
  if (light > 10) return "ไฟสลัว 🌑";
  return "มืดมากๆ 🕳️";
}

function getTempStatus(temp: number): string {
  if (temp > 35) return "อุณหภูมิร้อนมาก ⚠️";
  if (temp >= 30) return "อุณหภูมิร้อน 🔥";
  if (temp >= 25) return "อุณหภูมิอุ่นๆ 🌞";
  if (temp >= 20) return "อุณหภูมิพอดี 🌤";
  return "อุณหูมิเย็น ❄️";
}

function getHumidityStatus(humidity: number): string {
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด 🌧️";
  if (humidity > 70) return "อากาศชื้น เหนียวตัว 💦";
  if (humidity > 60) return "เริ่มชื้น 🌫️";
  if (humidity > 40) return "อากาศสบาย ✅";
  if (humidity > 30) return "ค่อนข้างแห้ง 💨";
  if (humidity > 20) return "แห้งมาก 🥵";
  return "อากาศแห้งมาก 🏜️";
}

// ===== LINE Reply =====
async function replyToUser(replyToken: string, message: string) {
  try {
    await axios.post("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [{ type: "text", text: message }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ ส่งค่า \n" , message , ")\n ส่งผ่าน Line แล้ว");
    console.log("✅ ตอบกลับผู้ใช้แล้ว");
  } catch (err: any) {
    console.error("❌ LINE reply error:", err?.response?.data || err?.message);
  }
}

// ===== Webhook =====
app.post("/webhook", async (req: Request, res: Response) => {
  const events = req.body.events;

  for (const event of events) {
    const userId = event?.source?.userId;
    const replyToken = event?.replyToken;
    const messageType = event?.message?.type;
    const text = event?.message?.text?.trim();

    if (!userId || !replyToken) continue;

    // Save userId
    await prisma.user.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    if (!lastSensorData) {
      await replyToUser(replyToken, "❌ ยังไม่มีข้อมูลเซ็นเซอร์");
      continue;
    }

    const { light, temp, humidity } = lastSensorData;
    const lightStatus = getLightStatus(light);
    const tempStatus = getTempStatus(temp);
    const humidityStatus = getHumidityStatus(humidity);

    // ถ้าไม่ใช่ข้อความ
    if (messageType !== "text" || text.includes("สวัสดี")) {
      const msg = `📊 สภาพอากาศล่าสุด:
    - ค่าแสง: ${light} lux (${lightStatus})
    - อุณหภูมิ: ${temp} °C (${tempStatus})
    - ความชื้น: ${humidity} % (${humidityStatus})`;
      await replyToUser(replyToken, msg);
      continue;
    }

    // ถาม AI
    const systemPrompt = `คุณเป็นผู้ช่วยวิเคราะห์สภาพอากาศจากเซ็นเซอร์`;
    const userPrompt = `
ข้อมูลเซ็นเซอร์:
- ค่าแสง: ${light} lux
- อุณหภูมิ: ${temp} °C
- ความชื้น: ${humidity} %
คำถาม: "${text}"
ตอบสั้น ๆ ชัดเจน เป็นภาษาไทย`;

    let aiAnswer = "❌ ไม่สามารถวิเคราะห์ได้";
    try {
      const aiRes = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      aiAnswer = aiRes.data?.choices?.[0]?.message?.content || aiAnswer;
    } catch (err: any) {
      console.error("❌ AI error:", err?.response?.data || err?.message);
    }

    const replyText = `📊 สภาพอากาศล่าสุด:
- ค่าแสง: ${light} lux (${lightStatus})
- อุณหภูมิ: ${temp} °C (${tempStatus})
- ความชื้น: ${humidity} % (${humidityStatus})
🤖 คำตอบจาก AI:
${aiAnswer}`;

    await replyToUser(replyToken, replyText);
  }

  res.sendStatus(200);
});

// ===== ESP32 Sensor Data =====
app.post("/sensor-data", (req: Request, res: Response) => {
  const { light, temp, humidity } = req.body;
  if (light !== undefined && temp !== undefined && humidity !== undefined) {
    lastSensorData = { light, temp, humidity };
    res.json({ message: "✅ รับข้อมูลแล้ว" });
  } else {
    res.status(400).json({ message: "❌ ข้อมูลไม่ครบ" });
  }
});

// ===== Get Latest Sensor Data =====
app.get("/latest", (req: Request, res: Response) => {
  if (lastSensorData) {
    res.json(lastSensorData);
  } else {
    res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
  }
});

// ===== Auto Report Every 10 mins =====
setInterval(async () => {
  if (!lastSensorData) return;

  const { light, temp, humidity } = lastSensorData;
  const lightStatus = getLightStatus(light);
  const tempStatus = getTempStatus(temp);
  const humidityStatus = getHumidityStatus(humidity);

  const systemPrompt = `คุณเป็นผู้ช่วยวิเคราะห์สภาพอากาศจากเซ็นเซอร์`;
  const userPrompt = `
ข้อมูลเซ็นเซอร์:
- ค่าแสง: ${light} lux
- อุณหภูมิ: ${temp} °C
- ความชื้น: ${humidity} %
คำถาม: "วิเคราะห์สภาพอากาศขณะนี้"
ตอบสั้น ๆ ชัดเจน เป็นภาษาไทย`;

  let aiAnswer = "❌ ไม่สามารถวิเคราะห์ได้";
  try {
    const aiRes = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    aiAnswer = aiRes.data?.choices?.[0]?.message?.content || aiAnswer;
  } catch (err: any) {
    console.error("❌ AI error (auto report):", err?.response?.data || err?.message);
  }

  const message = `📡 รายงานอัตโนมัติทุก 10 นาที:
- ค่าแสง: ${light} lux (${lightStatus})
- อุณหภูมิ: ${temp} °C (${tempStatus})
- ความชื้น: ${humidity} % (${humidityStatus})
🤖 คำตอบจาก AI:
${aiAnswer}`;

  try {
    await axios.post("https://api.line.me/v2/bot/message/push", {
      to: LINE_GROUP_ID,
      messages: [{ type: "text", text: message }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ ส่งรายงานอัตโนมัติแล้ว");
  } catch (err: any) {
    console.error("❌ ส่งรายงานล้มเหลว:", err?.response?.data || err?.message);
  }
}, 10 * 60 * 1000); // ทุก 10 นาที

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
