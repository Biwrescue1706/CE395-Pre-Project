import { Router } from "express";
import { lastSensorData } from "../utils/sensor.helper";

const router = Router();

router.post("/", (req, res) => {
  const { light, temp, humidity } = req.body;
  if (light !== undefined && temp !== undefined && humidity !== undefined) {
    lastSensorData.light = Number(light);
    lastSensorData.temp = Number(temp);
    lastSensorData.humidity = Number(humidity);
    res.json({ message: "✅ รับข้อมูลแล้ว" });
  } else {
    res.status(400).json({ message: "❌ ข้อมูลไม่ครบ" });
  }
});

export default router;
