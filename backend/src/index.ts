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
app.use(bodyParser.json());

let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

function cleanAIResponse(text: string): string {
  return text.replace(/<think>.*?<\/think>/, "").replace(/<[^>]+>/g, "").trim();
}

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
async function replyToUserAndDelete(id: number, replyToken: string, message: string) {
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

    await prisma.pendingReply.delete({ where: { id } });
    console.log("✅ ส่งข้อความกลับ LINE แล้ว:", trimmedMessage);
    console.log("✅ ลบ replyToken:", id);
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
  const prompt = `แสง: ${light} lux, อุณหภูมิ: ${temp}°C, ความชื้น: ${humidity}%\nคำถาม: ${question} กรุณาตอบคำถามนี้ด้วยภาษาที่สุภาพ ชัดเจน สั้นกระชับ และเป็นภาษาไทยทั้งหมด ห้ามมีภาษาอังกฤษเด็ดขาด`;

  try {
    console.log("📤 กำลังถาม AI:", { question, prompt });

    const res = await axios.post("http://localhost:11434/api/generate", {
      model: "gemma:7b",
      prompt,
      system: "คุณคือผู้ช่วยวิเคราะห์อากาศ ตอบด้วยภาษาไทยเท่านั้น",
      stream: false
    });

    console.log("🤖 ได้คำตอบจาก AI:", res.data);
    return cleanAIResponse(res.data?.response || "❌ ไม่สามารถตอบคำถามได้");
  } catch (err: any) {
    console.error("❌ AI Error:", err?.response?.data || err?.message || err);
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

    if (!userId) continue;

    const existingUser = await prisma.user.findUnique({ where: { userId } });
    if (!existingUser) {
      await prisma.user.create({ data: { userId } });
      console.log(`✅ บันทึก userId ใหม่: ${userId}`);
    } else {
      console.log(`✅ มี userId นี้อยู่แล้ว: ${userId}`);
    }

    // ตรวจสอบว่า replyToken ซ้ำหรือยัง
    const exists = await prisma.pendingReply.findUnique({
      where: { replyToken }
    });
    if (exists) {
      console.log(`⏭️ ข้ามซ้ำ replyToken: ${replyToken}`);
      continue;
    } else {
      console.log(`✅ ไม่มีซ้ำ replyToken: ${replyToken}`);
    }

    // บันทึกข้อความลง PendingReply
    const created = await prisma.pendingReply.create({
      data: { replyToken, userId, messageType, text }
    });
    console.log(`✅ บันทึก PendingReply ID ${created.id}`);

    if (!lastSensorData) {
      await replyToUserAndDelete(created.id, replyToken, "❌ ยังไม่มีข้อมูลจากเซ็นเซอร์");
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
      await replyToUserAndDelete(created.id, replyToken, msg);
      continue;
    }

    let replyText = "";

    if (text === "สภาพอากาศตอนนี้เป็นอย่างไร") {
      replyText = `📊 สภาพอากาศตอนนี้ :
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

    await replyToUserAndDelete(created.id, replyToken, replyText);
  }

  res.sendStatus(200);
});

// ===== เซ็นเซอร์ ESP
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

// ===== AI จากหน้าเว็บ
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

// ===== รายงานอัตโนมัติ
setInterval(async () => {
  if (!lastSensorData) return;

  const { light, temp, humidity } = lastSensorData;
  const lightStatus = getLightStatus(light);
  const tempStatus = getTempStatus(temp);
  const humidityStatus = getHumidityStatus(humidity);

  // ❗ รอ AI ตอบก่อน แล้วค่อยเก็บเวลาปัจจุบันหลังจากนี้
  const rawAiAnswer = await askOllama("วิเคราะห์สภาพอากาศขณะนี้", light, temp, humidity);
  const aiAnswer = cleanAIResponse(rawAiAnswer);

  // ✅ เวลา ณ ขณะ "จะส่งจริง"
  const now = dayjs().tz("Asia/Bangkok");
  const buddhistYear = now.year() + 543;
  const thaiDays = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const dayName = thaiDays[now.day()];
  const monthName = thaiMonths[now.month()];
  const thaiDaysTime = `${dayName} ที่ ${now.date()} ${monthName} พ.ศ.${buddhistYear} `;
  const thaiTimeTime = `${now.format("HH:mm")} น.`;

  const message = `📡 รายงานอัตโนมัติ :
📅 วันที่ : ${thaiDaysTime}
🕒 เวลา : ${thaiTimeTime}
💡 แสง : ${light} lux (${lightStatus})
🌡️ อุณหภูมิ : ${temp} °C (${tempStatus})
💧 ความชื้น : ${humidity} % (${humidityStatus})
🤖 AI : ${aiAnswer}`;

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

  console.log(`✅ รายงานอัตโนมัติส่งแล้วเวลาไทย : เมื่อวัน : ${thaiDaysTime} เวลา : ${thaiTimeTime}`);
}, 10 * 60 * 1000);


// ===== Root
app.get("/", async (req: Request, res: Response) => {
  try {
    const sensor = await axios.get("http://localhost:3000/latest");
    const { light, temp, humidity } = sensor.data;
    const lightStatus = getLightStatus(light);
    const tempStatus = getTempStatus(temp);
    const humidityStatus = getHumidityStatus(humidity);
    res.send(`✅ Backend is running <br>
      ✅ Hello World!<br>
💡 ค่าแสง: ${light} lux ( ${lightStatus} ) <br>
🌡 อุณหภูมิ: ${temp} °C ( ${tempStatus} ) <br>
💧 ความชื้น: ${humidity} % ( ${humidityStatus} )`);
  } catch {
    res.send(`✅ Backend is running <br>
      ✅ Hello World!`);
  }
});

// ===== Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
