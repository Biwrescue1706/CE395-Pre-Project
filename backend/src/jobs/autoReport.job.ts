import { getAllUserIds } from "../services/user.service";
import { askOllama } from "../services/ai.service";
import { lastSensorData, getLightStatus, getTempStatus, getHumidityStatus } from "../utils/sensor.helper";
import axios from "axios";

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";

export function startAutoReportJob() {
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

    const userIds = await getAllUserIds();
    for (const userId of userIds) {
      await axios.post("https://api.line.me/v2/bot/message/push", {
        to: userId,
        messages: [{ type: "text", text: message }],
      }, {
        headers: {
          Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
    }
  }, 5 * 60 * 1000);
}
