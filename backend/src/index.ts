require("dotenv").config();
import express, { Request, Response } from "express";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

// ===== Helper =====
function cleanAIResponse(text: string): string {
  return text.replace(/<think>.*?<\/think>/gi, "").replace(/<[^>]+>/g, "").trim();
}

function getLightStatus(light: number): string {
  if (light > 50000) return "สว่างจัดมาก";
  if (light > 10000) return "สว่างมาก";
  if (light > 5000) return "สว่างปานกลาง";
  if (light > 1000) return "ค่อนข้างสว่าง";
  if (light > 500) return "แสงพอใช้";
  if (light > 100) return "แสงน้อย";
  if (light > 10) return "มืดสลัว";
  return "มืดมาก";
}

function getTempStatus(temp: number): string {
  if (temp > 35) return "อุณหภูมิร้อนมาก";
  if (temp >= 30) return "อุณหภูมิร้อน";
  if (temp >= 25) return "อุณหภูมิอุ่นๆ";
  if (temp >= 20) return "อุณหภูมิพอดี";
  return "อุณหูมิเย็น";
}

function getHumidityStatus(humidity: number): string {
  if (humidity > 85) return "ชื้นมาก อากาศอึดอัด";
  if (humidity > 70) return "อากาศชื้น เหนียวตัว";
  if (humidity > 60) return "เริ่มชื้น";
  if (humidity > 40) return "อากาศสบาย";
  if (humidity > 30) return "ค่อนข้างแห้ง";
  if (humidity > 20) return "แห้งมาก";
  return "อากาศแห้งมาก";
}

// ===== AI =====
async function askOllama(question: string, light: number, temp: number, humidity: number): Promise<string> {
  const prompt = `
แสง: ${light} lux, อุณหภูมิ: ${temp}°C, 
ความชื้น: ${humidity}%\nคำถาม: ${question} 
กรุณาตอบคำถามนี้ด้วยภาษาที่สุภาพ ชัดเจน สั้นกระชับ 
และเป็นภาษาไทยทั้งหมด ห้ามมีภาษาอังกฤษเด็ดขาด และห้ามตอบแปลกๆ หรือออกนอกเรื่อง`;

  try {
    console.log("📤 กำลังถาม AI:", { question }, "\n", { prompt });
    const res = await axios.post("http://localhost:11434/api/generate", {
      model: "gemma:7b",
      prompt,
      system: "คุณคือผู้ช่วยวิเคราะห์อากาศ ตอบด้วยภาษาไทยเท่านั้น",
      stream: false,
    });

    const cleaned = cleanAIResponse(res.data?.response || "");
    console.log("🤖 คำตอบจาก AI:", cleaned);
    return cleaned;
  } catch (err: any) {
    console.error("❌ AI Error:", err?.response?.data || err?.message);
    return "";
  }
}

// ===== LINE Reply =====
async function replyToUser(replyToken: string, message: string) {
  try {
    const trimmedMessage = message.length > 1000 ? message.slice(0, 1000) + "\n...(ตัดข้อความ)" : message;
    await axios.post("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [{ type: "text", text: trimmedMessage }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("❌ LINE reply error:", err?.response?.data || err?.message);
  }
}

async function deletePendingReply(id: number) {
  try {
    await prisma.pendingReply.delete({ where: { id } });
  } catch (err: any) {
    console.error("❌ ลบ PendingReply ไม่สำเร็จ:", err?.response?.data || err?.message);
  }
}

// ===== Webhook =====
app.post("/webhook", async (req: Request, res: Response) => {
  res.sendStatus(200);
  const events = req.body.events || [];
  for (const event of events) {
    if (event?.type === "message" && event?.replyToken && event?.source?.userId) {
      processMessageEvent(event).catch(console.error);
    }
  }
});

async function processMessageEvent(event: any) {
  const userId = event?.source?.userId;
  const replyToken = event?.replyToken;
  const messageType = event.message?.type || "unknown";
  const text = messageType === "text" ? event.message.text.trim() : "";

  const existingUser = await prisma.user.findUnique({ where: { userId } });
  if (!existingUser) await prisma.user.create({ data: { userId } });

  const exists = await prisma.pendingReply.findUnique({ where: { replyToken } });
  if (exists) return;

  const created = await prisma.pendingReply.create({
    data: { replyToken, userId, messageType, text: text || "(ไม่มีข้อความ)" },
  });

  if (!lastSensorData) {
    await replyToUser(replyToken, "❌ ยังไม่มีข้อมูลจากเซ็นเซอร์");
    await deletePendingReply(created.id);
    return;
  }

  const { light, temp, humidity } = lastSensorData;
  const lightStatus = getLightStatus(light);
  const tempStatus = getTempStatus(temp);
  const humidityStatus = getHumidityStatus(humidity);

  const shortMsg = `📊 สภาพอากาศล่าสุด :
- ค่าแสง: ${light} lux (${lightStatus})
- อุณหภูมิ: ${temp} °C (${tempStatus})
- ความชื้น: ${humidity} % (${humidityStatus})`;

  const presetQuestions = [
    "สภาพอากาศตอนนี้เป็นอย่างไร",
    "ตอนนี้ควรตากผ้าไหม",
    "ตอนนี้ควรพกร่มออกจากบ้านไหม",
    "ความเข้มของแสงตอนนี้เป็นอย่างไร",
    "ความชื้นตอนนี้เป็นอย่างไร",
  ];

  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!presetQuestions.includes(normalizedText)) {
    await replyToUser(replyToken, shortMsg);
    await deletePendingReply(created.id);
    return;
  }

  await replyToUser(replyToken, "⏳ กำลังถาม AI...");

  const aiText = await askOllama(normalizedText, light, temp, humidity);
  if (!aiText || aiText.trim() === "") {
    await replyToUser(replyToken, "❌ คำตอบจาก AI ว่างเปล่า ไม่สามารถส่งข้อความได้");
    await deletePendingReply(created.id);
    return;
  }

  const answer = `${normalizedText}?\n- คำตอบ จาก AI : ${aiText.trim()}`;

  await axios.post("https://api.line.me/v2/bot/message/push", {
    to: userId,
    messages: [{ type: "text", text: answer }],
  }, {
    headers: {
      Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  await deletePendingReply(created.id);
}

// ===== Sensor APIs =====
app.post("/sensor-data", (req: Request, res: Response) => {
  const { light, temp, humidity } = req.body;
  if (light !== undefined && temp !== undefined && humidity !== undefined) {
    lastSensorData = { light, temp, humidity };
    res.json({ message: "✅ รับข้อมูลแล้ว" });
  } else {
    res.status(400).json({ message: "❌ ข้อมูลไม่ครบ" });
  }
});

app.get("/latest", (req: Request, res: Response) => {
  if (lastSensorData) res.json(lastSensorData);
  else res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
});

// ===== AI Web API =====
app.post("/ask-ai", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question || !lastSensorData) {
    res.status(400).json({ error: "❌ คำถามหรือข้อมูลไม่ครบ" });
    return;
  }

  const { light, temp, humidity } = lastSensorData;
  const raw = await askOllama(question, light, temp, humidity);
  const cleaned = cleanAIResponse(raw);
  res.json({ answer: cleaned });
});

// ===== Root =====
app.get("/", (req: Request, res: Response) => {
  if (!lastSensorData) {
    res.send("✅ Backend is running<br>⚠️ ยังไม่มีข้อมูลเซ็นเซอร์");
    return;
  }
  const { light, temp, humidity } = lastSensorData;
  res.send(`✅ Backend is running <br>
💡 ค่าแสง: ${light} lux (${getLightStatus(light)})<br>
🌡️ อุณหภูมิ: ${temp} °C (${getTempStatus(temp)})<br>
💧 ความชื้น: ${humidity} % (${getHumidityStatus(humidity)})`);
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
