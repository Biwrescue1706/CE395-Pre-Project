import axios from "axios";

export async function askOllama(question: string, light: number, temp: number, humidity: number): Promise<string> {
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
