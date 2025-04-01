"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "";
const LINE_GROUP_ID = process.env.LINE_GROUP_ID || "";
// ฟังก์ชันส่ง Line แจ้งเตือน
function sendLineNotification(light, temp, humidity) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        let lightStatus = "";
        let tempStatus = "";
        let humidityStatus = "";
        // ✅ ตรวจสอบค่าแสง
        if (light > 5000) {
            lightStatus = "แสงสูง ☀️";
        }
        else if (light < 1000) {
            lightStatus = "แสงต่ำ 🌑";
        }
        else {
            lightStatus = "แสงปกติ 🌤";
        }
        // ✅ ตรวจสอบค่าอุณหภูมิ
        if (temp > 35) {
            tempStatus = "อุณหภูมิสูง (อากาศร้อน) 🔥";
        }
        else if (temp < 20) {
            tempStatus = "อุณหภูมิต่ำ ❄️";
        }
        else {
            tempStatus = "อุณหภูมิปกติ 🌡";
        }
        // ✅ ตรวจสอบค่าความชื้น
        if (humidity > 80) {
            humidityStatus = "ความชื้นสูง อาจมีฝนตก 🌧";
        }
        else if (humidity < 30) {
            humidityStatus = "ความชื้นต่ำ 💨";
        }
        else {
            humidityStatus = "ความชื้นปกติ 💧";
        }
        const message = `⚠ แจ้งเตือน! ⚠
📅 วันที่: ${new Date().toLocaleString()} น.
☀ แสงแดด: ${light} lux (${lightStatus})
🌡 อุณหภูมิ: ${temp}°C (${tempStatus})
💧 ความชื้น: ${humidity}% (${humidityStatus})`;
        try {
            yield axios_1.default.post("https://api.line.me/v2/bot/message/push", {
                to: LINE_GROUP_ID,
                messages: [{ type: "text", text: message }]
            }, { headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` } });
            console.log("✅ ส่งข้อความแจ้งเตือนสำเร็จ!");
        }
        catch (error) {
            const axiosError = error;
            console.error("❌ แจ้งเตือนล้มเหลว:", ((_a = axiosError.response) === null || _a === void 0 ? void 0 : _a.data) || axiosError.message);
        }
    });
}
// ✅ Route รับค่าจาก ESP32
app.post("/sensor-data", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { light, temp, humidity } = req.body;
    if (light !== undefined && temp !== undefined && humidity !== undefined) {
        yield sendLineNotification(light, temp, humidity);
        res.json({ message: "✅ ข้อมูลถูกส่งไปยังไลน์แล้ว!" });
    }
    else {
        res.status(400).json({ message: "❌ ข้อมูลไม่ครบถ้วน" });
    }
}));

// ✅ Start Server
app.listen(PORT, () => {
    console.log(`Server runnig on port http://localhost:${PORT}`);
});
