const path = require('path');
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');
const { testConnection, pool } = require('./config/db');
const { attachUserToLocals } = require('./middleware/auth');
const { metricsMiddleware, getMetrics } = require('./middleware/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cấu hình tài nguyên tĩnh (Static Files)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware xử lý URL-encoded và JSON body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Logger cấu hình chuẩn xuất ra stdout (Loki / Promtail dễ thu thập)
morgan.token('date-vn', () => new Date().toISOString());
app.use(morgan('[:date-vn] :method :url :status :res[content-length] - :response-time ms'));

// Cấu hình Session
app.use(session({
  name: 'lms_sid',
  secret: process.env.SESSION_SECRET || 'lms-super-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 ngày
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Endpoint xuất Metrics chuẩn Prometheus
app.get('/metrics', getMetrics);

// Gắn thông tin người dùng hiện tại vào res.locals
app.use(attachUserToLocals);

// Các Router nghiệp vụ
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const lessonRoutes = require('./routes/lessons');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

app.use('/auth', authRoutes);
app.use('/courses', courseRoutes);
app.use('/lessons', lessonRoutes);
app.use('/student', studentRoutes);
app.use('/admin', adminRoutes);
app.use('/', apiRoutes);

// Trang chủ (Landing Page)
app.get('/', async (req, res) => {
  try {
    const [featuredCourses] = await pool.query(`
      SELECT c.*, cat.name as category_name,
             COUNT(DISTINCT l.id) as total_lessons,
             COUNT(DISTINCT e.id) as total_students
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.created_at DESC LIMIT 12
    `);

    const [categories] = await pool.query('SELECT * FROM categories');
    const [stats] = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM courses) as course_count,
        (SELECT COUNT(*) FROM users WHERE role = 'student') as student_count,
        (SELECT COUNT(*) FROM lessons) as lesson_count
    `);

    res.render('index', {
      title: 'Hệ Thống LMS Trực Tuyến - Học Tập Không Giới Hạn',
      featuredCourses,
      categories,
      stats: stats[0]
    });
  } catch (err) {
    console.error(`[HOME-ERROR] Lỗi tải trang chủ: ${err.message}`);
    res.render('index', {
      title: 'Hệ Thống LMS Trực Tuyến',
      featuredCourses: [],
      categories: [],
      stats: { course_count: 0, student_count: 0, lesson_count: 0 }
    });
  }
});

// Xử lý 404 Not Found
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Không tìm thấy trang',
    message: 'Trang bạn đang tìm kiếm không tồn tại trên hệ thống.',
    statusCode: 404
  });
});

// Xử lý lỗi tập trung 500
app.use((err, req, res, next) => {
  console.error(`[SERVER-ERROR] ${err.stack}`);
  res.status(500).render('error', {
    title: '500 - Lỗi máy chủ nội bộ',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Đã có sự cố xảy ra phía máy chủ.',
    statusCode: 500
  });
});

// Khởi chạy Server sau khi kiểm tra kết nối DB
async function startServer() {
  console.log('[System] Đang khởi động hệ thống LMS Web App...');
  await testConnection();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 [LMS-SERVER] Ứng dụng đã sẵn sàng chạy trên cổng ${PORT}`);
    console.log(`👉 Trang chủ: http://localhost:${PORT}`);
    console.log(`👉 Prometheus Metrics: http://localhost:${PORT}/metrics`);
    console.log(`👉 Health Check: http://localhost:${PORT}/health`);
    console.log(`=======================================================`);
  });
}

startServer();
