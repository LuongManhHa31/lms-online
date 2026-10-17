const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'lms_user',
  password: process.env.DB_PASSWORD || 'lms_secret_2026',
  database: process.env.DB_NAME || 'lms_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Hàm kiểm tra kết nối với cơ chế thử lại (Retry) khi container MySQL đang khởi động
async function testConnection(retries = 15, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log(`[Database] Đã kết nối thành công tới MySQL tại ${process.env.DB_HOST || 'mysql'}:${process.env.DB_PORT || 3306}`);
      connection.release();
      return true;
    } catch (err) {
      console.warn(`[Database] Lần thử ${i}/${retries} kết nối MySQL thất bại: ${err.message}. Đang thử lại sau ${delayMs / 1000}s...`);
      if (i === retries) {
        console.error('[Database] Không thể kết nối tới MySQL sau nhiều lần thử.');
        return false;
      }
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

module.exports = {
  pool,
  testConnection
};
