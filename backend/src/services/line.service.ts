import axios from "axios";

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";

export async function replyToUser(replyToken: string, message: string) {
  try {
    await axios.post("https://api.line.me/v2/bot/message/reply", {
      replyToken,
      messages: [{ type: "text", text: message }],
    }, {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ ส่งผ่าน Line แล้ว");
  } catch (err: any) {
    console.error("❌ LINE reply error:", err?.response?.data || err?.message);
  }
}
