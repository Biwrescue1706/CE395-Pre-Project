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
    const trimmedMessage = message.length > 4000 ? message.slice(0, 4000) + "\n...(ตัดข้อความ)" : message;
    await axios.post("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [{ type: "text", text: trimmedMessage }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ ส่งข้อความกลับ LINE แล้ว:", trimmedMessage);
  } catch (err: any) {
    console.error("❌ LINE reply error:", err?.response?.data || err?.message);
  }
}

// ====== Ollama AI ======
async function askOllama(
  question: string,
  light: number,
  temp: number,
  humidity: number
): Promise<string> {
  const systemPrompt = "คุณเป็นผู้ช่วยวิเคราะห์สภาพอากาศจากเซ็นเซอร์";
  const userPrompt = `
ข้อมูลเซ็นเซอร์:
- ค่าแสง: ${light} lux
- อุณหภูมิ: ${temp} °C
- ความชื้น: ${humidity} %
คำถาม: "${question}"
ตอบสั้น ๆ ชัดเจน เป็นภาษาไทย`;

  try {
    const response = await axios.post("http://localhost:11434/api/chat", {
      model: "deepseek-r1:14b-qwen-distill-q4_K_M",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    });
    return response.data?.message?.content || "❌ ไม่สามารถตอบคำถามได้";
  } catch (err) {
    console.error("❌ Ollama error:", err);
    return "❌ เกิดข้อผิดพลาดในการติดต่อ AI";
  }
}

// ===== Webhook =====
app.post("/webhook", async (req: Request, res: Response) => {
  const events = req.body.events;

  for (const event of events) {
    const userId = event?.source?.userId;
    const replyToken = event?.replyToken;
    const text = event?.message?.text?.trim() || "";
    const messageType = event?.message?.type;

    console.log("✅ รับข้อมูลจาก LINE:", {
      replyToken,
      userId,
      messageType,
      text
    });

    if (!userId || !replyToken) continue;

    const existingUser = await prisma.user.findUnique({ where: { userId } });
    if (!existingUser) {
      await prisma.user.create({ data: { userId } });
      console.log(`✅ บันทึก userId ใหม่: ${userId}`);
    } else {
      console.log(`✅ มี userId นี้อยู่แล้ว: ${userId}`);
    }

    if (!lastSensorData) {
      await replyToUser(replyToken, "❌ ยังไม่มีข้อมูลจากเซ็นเซอร์");
      continue;
    }

    const { light, temp, humidity } = lastSensorData;
    const lightStatus = getLightStatus(light);
    const tempStatus = getTempStatus(temp);
    const humidityStatus = getHumidityStatus(humidity);

    if (messageType !== "text" || text.includes("สวัสดี")) {
      const msg = `📊 สภาพอากาศล่าสุด :
💡 ค่าแสง: ${light} lux (${lightStatus})
🌡️ อุณหภูมิ: ${temp} °C (${tempStatus})
💧 ความชื้น: ${humidity} % (${humidityStatus})`;
      await replyToUser(replyToken, msg);
      continue;
    }

    let replyText = "";

    if (text === "สภาพอากาศตอนนี้เป็นอย่างไร") {
      replyText = `📊 สภาพอากาศล่าสุด :
💡 ค่าแสง: ${light} lux (${lightStatus})
🌡️ อุณหภูมิ: ${temp} °C (${tempStatus})
💧 ความชื้น: ${humidity} % (${humidityStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
    } else if (text === "ตอนนี้ควรตากผ้าไหม") {
      replyText = `📌 ตอนนี้ควรตากผ้าไหม :
💡 ค่าแสง: ${light} lux (${lightStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
    } else if (text === "ควรพกร่มออกจากบ้านไหม") {
      replyText = `📌 ควรพกร่มออกจากบ้านไหม :
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
    } else if (text === "ความเข้มของแสงตอนนี้เป็นอย่างไร") {
      replyText = `📊 ความเข้มของแสงตอนนี้ :
💡 ค่าแสง: ${light} lux (${lightStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
    } else if (text === "ความชื้นตอนนี้เป็นอย่างไร") {
      replyText = `📊 ความชื้นตอนนี้ :
💧 ความชื้น: ${humidity} % (${humidityStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
    } else {
      replyText = await askOllama(text, light, temp, humidity);
    }

    await replyToUser(replyToken, replyText);
  }

  res.sendStatus(200);
});

// ===== ESP8266/ESP32 Sensor Data
app.post("/sensor-data", (req: Request, res: Response) => {
  const { light, temp, humidity } = req.body;
  if (light !== undefined && temp !== undefined && humidity !== undefined) {
    lastSensorData = { light, temp, humidity };
    res.json({ message: "✅ รับข้อมูลแล้ว" });
  } else {
    res.status(400).json({ message: "❌ ข้อมูลไม่ครบ" });
  }
});

// ===== Get Latest Sensor Data
app.get("/latest", (req: Request, res: Response) => {
  if (lastSensorData) {
    res.json(lastSensorData);
  } else {
    res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
  }
});

// ===== ถาม AI จาก frontend
app.post("/ask-ai", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question || !lastSensorData) {
    res.status(400).json({ error: "❌ คำถามหรือข้อมูลไม่ครบ" });
    return;
  }
  const { light, temp, humidity } = lastSensorData;
  const answer = await askOllama(question, light, temp, humidity);
  res.json({ answer });
});

// ===== รายงานอัตโนมัติทุก 5 นาที
setInterval(async () => {
  if (!lastSensorData) return;

  const { light, temp, humidity } = lastSensorData;
  const lightStatus = getLightStatus(light);
  const tempStatus = getTempStatus(temp);
  const humidityStatus = getHumidityStatus(humidity);
  const aiAnswer = await askOllama("วิเคราะห์สภาพอากาศขณะนี้", light, temp, humidity);

  const message = `📡 รายงานอัตโนมัติ :
💡 ค่าแสง: ${light} lux (${lightStatus})
🌡️ อุณหภูมิ: ${temp} °C (${tempStatus})
💧 ความชื้น: ${humidity} % (${humidityStatus})
🤖 AI: ${aiAnswer}`;

  const users = await prisma.user.findMany();
  for (const u of users) {
    await axios.post("https://api.line.me/v2/bot/message/push", {
      to: u.userId,
      messages: [{ type: "text", text: message }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }
}, 5 * 60 * 1000);

// ===== Root route
app.get("/", async (req: Request, res: Response) => {
  try {
    const sensor = await axios.get("http://localhost:3000/latest");
    const { light, temp, humidity } = sensor.data;
    const lightStatus = getLightStatus(light);
    const tempStatus = getTempStatus(temp);
    const humidityStatus = getHumidityStatus(humidity);
    res.send(`✅ Hello World!<br>
💡 ค่าแสง: ${light} lux ( ${lightStatus} ) <br>
🌡 อุณหภูมิ: ${temp} °C ( ${tempStatus} ) <br>
💧 ความชื้น: ${humidity} % ( ${humidityStatus} )`);
  } catch {
    res.send(`✅ Hello World!`);
  }
});

// ===== Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
