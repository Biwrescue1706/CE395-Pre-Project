import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getLightStatus, getTempStatus, getHumidityStatus, lastSensorData } from "../utils/sensor.helper";
import { askOllama } from "../services/ai.service";
import { replyToUser } from "../services/line.service";
import { saveUserIfNotExists } from "../services/user.service";

const router = Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    const userId = event?.source?.userId;
    const replyToken = event?.replyToken;
    const text = event?.message?.text?.trim() || "";
    const messageType = event?.message?.type;

    if (!userId || !replyToken) continue;
    await saveUserIfNotExists(userId);

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
    switch (text) {
      case "สภาพอากาศตอนนี้เป็นอย่างไร":
        replyText = `📊 สภาพอากาศล่าสุด :
💡 ค่าแสง: ${light} lux (${lightStatus})
🌡️ อุณหภูมิ: ${temp} °C (${tempStatus})
💧 ความชื้น: ${humidity} % (${humidityStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
        break;
      case "ตอนนี้ควรตากผ้าไหม":
        replyText = `📌 ตอนนี้ควรตากผ้าไหม :
💡 ค่าแสง: ${light} lux (${lightStatus})
🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
        break;
      case "ควรพกร่มออกจากบ้านไหม":
      case "ความเข้มของแสงตอนนี้เป็นอย่างไร":
      case "ความชื้นตอนนี้เป็นอย่างไร":
        replyText = `🤖 AI: ${await askOllama(text, light, temp, humidity)}`;
        break;
      default:
        replyText = await askOllama(text, light, temp, humidity);
        break;
    }

    await replyToUser(replyToken, replyText);
  }

  res.sendStatus(200);
});

export default router;
