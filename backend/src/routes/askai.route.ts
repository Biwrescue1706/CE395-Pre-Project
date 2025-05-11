import { Router, Request, Response } from "express";
import { askOllama } from "../services/ai.service";
import { lastSensorData } from "../utils/sensor.helper";

const router = Router();

router.post("/", async (req: Request, res: Response) : Promise<void> => {
  const { question } = req.body;
  if (!question || !lastSensorData) {
     res.status(400).json({ error: "❌ คำถามหรือข้อมูลไม่ครบ" });
     return
  }
  const { light, temp, humidity } = lastSensorData;
  const answer = await askOllama(question, light, temp, humidity);
  res.json({ answer });
});

export default router;
