const API_URL = "http://localhost:3000/latest";

async function fetchSensorData() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    console.log(data);  // ตรวจสอบข้อมูลที่ได้รับจาก Backend
    
    document.getElementById("light").textContent = data.light;
    document.getElementById("temp").textContent = data.temp;
    document.getElementById("humidity").textContent = data.humidity;

    const now = new Date().toLocaleString();
    document.getElementById("timestamp").textContent = now;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
  }
}


// โหลดครั้งแรก
fetchSensorData();
// Frontend โหลดข้อมูลทุก 5 วิ
setInterval(fetchSensorData, 5000);