import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';

type SensorData = {
  light: number;
  temp: number;
  humidity: number;
};

const App = () => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);

  // ดึงข้อมูลล่าสุดจาก API
  const fetchLatestSensorData = async () => {
    try {
      const response = await axios.get('http://localhost:3000/latest');
      setSensorData(response.data);
    } catch (error) {
      console.error('ไม่สามารถดึงข้อมูลได้', error);
    }
  };

  useEffect(() => {
    fetchLatestSensorData();
    const interval = setInterval(fetchLatestSensorData, 5000); // ดึงข้อมูลทุก 5 วินาที
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App">
      <h1>ข้อมูลเซ็นเซอร์ล่าสุด</h1>
      {sensorData ? (
        <div>
          <p>แสง: {sensorData.light} lux</p>
          <p>อุณหภูมิ: {sensorData.temp} °C</p>
          <p>ความชื้น: {sensorData.humidity} %</p>
        </div>
      ) : (
        <p>กำลังโหลดข้อมูล...</p>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

// เรนเดอร์แอป
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
