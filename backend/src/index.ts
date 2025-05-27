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

function cleanAIResponse(text: string): string {
  return text.replace(/<think>.*?<\/think>/, "").replace(/<[^>]+>/g, "").trim();
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

async function askOllama(question: string, light: number, temp: number, humidity: number): Promise<string> {
  const prompt = `แสง ${light} lux, อุณหภูมิ ${temp}°C, ความชื้น ${humidity}% คำถาม: ${question} ตอบเป็นภาษาไทยให้สุภาพ กระชับ ชัดเจน`;

  try {
    const res = await axios.post("http://localhost:11434/api/generate", {
      model: "gemma:7b",
      prompt,
      system: "คุณคือผู้ช่วยวิเคราะห์อากาศ ตอบด้วยภาษาไทยเท่านั้น",
      stream: false,
    });

    const cleaned = cleanAIResponse(res.data?.response || "");
    return cleaned.trim() || "❌ ไม่สามารถตอบคำถามได้";
  } catch {
    return "❌ เกิดข้อผิดพลาดในการติดต่อ AI";
  }
}

async function replyToUser(replyToken: string, message: string) {
  try {
    const trimmedMessage = message.length > 1000 ? message.slice(0, 1000) + "\n...(ตัดข้อความ)" : message;
    if (!trimmedMessage.trim()) return;
    await axios.post("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [{ type: "text", text: trimmedMessage }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  } catch {}
}

async function deletePendingReply(id: number) {
  try {
    await prisma.pendingReply.delete({ where: { id } });
  } catch {}
}

app.post("/webhook", async (req: Request, res: Response) => {
  res.sendStatus(200);
  const events = req.body.events || [];
  for (const event of events) {
    if (event?.type === "message" && event?.replyToken && event?.source?.userId) {
      processMessageEvent(event).catch(() => {});
    }
  }
});

async function processMessageEvent(event: any) {
  const userId = event?.source?.userId;
  const replyToken = event?.replyToken;
  const messageType = event.message?.type || "unknown";
  const text = messageType === "text" ? event.message.text.trim() : "";

  const existingUser = await prisma.user.findUnique({ where: { userId } });
  if (!existingUser) {
    await prisma.user.create({ data: { userId } });
    return;
  }

  const exists = await prisma.pendingReply.findUnique({ where: { replyToken } });
  if (exists) return;

  const created = await prisma.pendingReply.create({
    data: {
      replyToken,
      userId,
      messageType,
      text: text || "(ไม่มีข้อความ)",
    },
  });

  if (!lastSensorData) {
    await replyToUser(replyToken, "❌ ยังไม่มีข้อมูลจากเซ็นเซอร์");
    await deletePendingReply(created.id);
    return;
  }

  const { light, temp, humidity } = lastSensorData;
  const shortMsg = `📊 สภาพอากาศล่าสุด :
- ค่าแสง: ${light} lux (${getLightStatus(light)})
- อุณหภูมิ: ${temp} °C (${getTempStatus(temp)})
- ความชื้น: ${humidity} % (${getHumidityStatus(humidity)})`;

  if (messageType !== "text" || text.includes("สวัสดี")) {
    await replyToUser(replyToken, shortMsg);
    await deletePendingReply(created.id);
    return;
  }

  const presetQuestions = [
    "สภาพอากาศตอนนี้เป็นอย่างไร",
    "ตอนนี้ควรตากผ้าไหม",
    "ตอนนี้ควรพกร่มออกจากบ้านไหม",
    "ความเข้มของแสงตอนนี้เป็นอย่างไร",
    "ความชื้นตอนนี้เป็นอย่างไร",
  ];

  if (!presetQuestions.includes(text)) {
    await replyToUser(replyToken, shortMsg);
    await deletePendingReply(created.id);
    return;
  }

  await replyToUser(replyToken, "⏳ กำลังถาม AI...");
  const aiResponse = await askOllama(text, light, temp, humidity);
  const answer = `${text}?\n🤖 คำตอบ จาก AI : ${aiResponse}`;

  if (!answer.trim()) {
    await replyToUser(replyToken, "❌ ไม่สามารถตอบคำถามได้ (AI ว่าง)");
    await deletePendingReply(created.id);
    return;
  }

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

app.get("/", async (req: Request, res: Response): Promise<void> => {
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

// ===== Auto Report =====
// setInterval(async () => {
//   if (!lastSensorData) return;

//   const { light, temp, humidity } = lastSensorData;
//   const aiAnswer = cleanAIResponse(await askOllama("วิเคราะห์สภาพอากาศขณะนี้", light, temp, humidity));
//   const now = dayjs().tz("Asia/Bangkok");
//   const buddhistYear = now.year() + 543;
//   const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
//   const monthName = thaiMonths[now.month()];
//   const dateStr = `วันที่ ${now.date()} ${monthName} พ.ศ.${buddhistYear}`;
//   const timeStr = `${now.format("HH:mm")} น.`;

//   const message = `📡 รายงานอัตโนมัติ :
// 📅 ${dateStr}
// 🕒 ${timeStr}
// 💡 แสง : ${light} lux
// 🌡️ อุณหภูมิ : ${temp} °C
// 💧 ความชื้น : ${humidity} %
// 🤖 คำตอบจาก AI : ${aiAnswer}`;

//   const users = await prisma.user.findMany();
//   for (const u of users) {
//     await axios.post("https://api.line.me/v2/bot/message/push", {
//       to: u.userId,
//       messages: [{ type: "text", text: message }],
//     }, {
//       headers: {
//         Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//     });
//   }

//   return`✅ รายงานอัตโนมัติส่งเมื่อ ${dateStr} เวลา ${timeStr}`;
// }, 4 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
