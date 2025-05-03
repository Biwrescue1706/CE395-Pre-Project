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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

app.use(cors());
app.use(bodyParser.json());

// ✅ ตอบกลับผู้ใช้ LINE
async function replyToUser(replyToken: string, message: string) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken,
        messages: [{ type: "text", text: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ LINE reply error:", error?.response?.data || error?.message);
  }
}

// ✅ Webhook จาก LINE
app.post("/webhook", async (req: Request, res: Response) => {
  console.log("📥 รับ event จาก LINE:", JSON.stringify(req.body, null, 2));
  const events = req.body.events;

  for (const event of events) {
    const eventType = event?.type;
    const userId = event?.source?.userId;
    const text = event?.message?.text?.trim();
    const replyToken = event?.replyToken;

    console.log("📩 LINE EVENT:", { eventType, userId, text, replyToken });

    if (eventType !== "message" || !userId || !text || !replyToken) {
      console.log("❌ ไม่ใช่ข้อความ หรือข้อมูลไม่ครบ");
      continue;
    }

    // ✅ บันทึก userId
    try {
      await prisma.user.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      console.log("✅ บันทึก userId แล้ว:", userId);
    } catch (err) {
      console.error("❌ Prisma error:", err);
    }

    // ✅ ดึงค่าล่าสุดจากเซ็นเซอร์
    let sensorData;
    try {
      const res = await axios.get("https://ce395backend.loca.lt/latest");
      sensorData = res.data;
    } catch (err) {
      await replyToUser(replyToken, "❌ ยังไม่มีข้อมูลเซ็นเซอร์");
      continue;
    }

    const { light, temp, humidity } = sensorData;

    // ✅ คำถามส่งให้ AI
    const prompt = `
คุณคือผู้ช่วยวิเคราะห์สภาพอากาศ:
- ค่าแสง: ${light} lux
- ค่าอุณหภูมิ: ${temp} °C
- ค่าความชื้น: ${humidity} %
คำถามจากผู้ใช้: "${text}"
ตอบเป็นภาษาไทยแบบสั้น ๆ ชัดเจน
    `;

    let aiAnswer = "❌ ไม่สามารถวิเคราะห์ได้";

    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: text },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      aiAnswer = res.data?.choices?.[0]?.message?.content || aiAnswer;
    } catch (err: any) {
      console.error("❌ AI error:", err?.response?.data || err?.message);
    }

    // ✅ ส่งข้อความกลับ LINE
    const replyText = `ค่าแสง: ${light} lux
ค่าอุณหภูมิ: ${temp} °C
ค่าความชื้น: ${humidity} %
คำตอบจาก AI:
${aiAnswer}`;

    await replyToUser(replyToken, replyText);
  }

  res.sendStatus(200);
});

// ✅ เก็บค่าจากเซ็นเซอร์
let lastSensorData: { light: number; temp: number; humidity: number } | null = null;

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
  if (lastSensorData) {
    res.json(lastSensorData);
  } else {
    res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
