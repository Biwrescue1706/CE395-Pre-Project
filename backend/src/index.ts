import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import express, { Request, Response } from "express";

import webhookRouter from "./routes/webhook.route";
import sensorRouter from "./routes/sensor.route";
import askAiRouter from "./routes/askai.route";
import { startAutoReportJob } from "./jobs/autoReport.job";
import {
  lastSensorData,
  getLightStatus,
  getTempStatus,
  getHumidityStatus
} from "./utils/sensor.helper";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ===== Routes =====
app.use("/webhook", webhookRouter);
app.use("/sensor-data", sensorRouter);
app.use("/ask-ai", askAiRouter);

// ===== Sensor Latest =====
app.get("/latest", (req: Request, res: Response) => {
  if (lastSensorData) {
    res.json(lastSensorData);
  } else {
    res.status(404).json({ message: "❌ ไม่มีข้อมูลเซ็นเซอร์" });
  }
});

// ===== Root =====
app.get("/", (req: Request, res: Response)=> {
  if (!lastSensorData) {
    res.send("✅ Hello World!");
    
  }

  const { light, temp, humidity } = lastSensorData;
  res.send(`✅ Hello World!<br>
💡 ค่าแสง: ${light} lux (${getLightStatus(light)}) <br>
🌡️ อุณหภูมิ: ${temp} °C (${getTempStatus(temp)}) <br>
💧 ความชื้น: ${humidity} % (${getHumidityStatus(humidity)})`);
});

// ===== Background Job =====
startAutoReportJob();

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
