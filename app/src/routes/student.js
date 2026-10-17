const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// Khóa học của tôi (Dành cho học viên đã đăng ký)
router.get('/my-courses', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [courses] = await pool.query(`
      SELECT 
        c.*, 
        cat.name as category_name,
        e.enrolled_at,
        e.status as enrollment_status,
        COUNT(DISTINCT l.id) as total_lessons,
        COUNT(DISTINCT lp.lesson_id) as completed_lessons
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN lesson_progress lp ON lp.user_id = e.user_id 
                                    AND lp.lesson_id = l.id 
                                    AND lp.is_completed = 1
      WHERE e.user_id = ?
      GROUP BY c.id, e.id
      ORDER BY e.enrolled_at DESC
    `, [userId]);

    res.render('student/my-courses', {
      title: 'Khóa học của tôi - LMS Online',
      courses,
      welcome: req.query.welcome || null
    });
  } catch (err) {
    console.error(`[STUDENT-ERROR] Lỗi tải khóa học của tôi: ${err.message}`);
    res.status(500).render('error', {
      title: 'Lỗi máy chủ',
      message: 'Không thể tải danh sách khóa học của bạn lúc này.',
      statusCode: 500
    });
  }
});

// Trang hồ sơ cá nhân
router.get('/profile', isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [users] = await pool.query('SELECT id, username, email, full_name, role, avatar, created_at FROM users WHERE id = ?', [userId]);
    const [stats] = await pool.query('SELECT COUNT(*) as enrolled_count FROM enrollments WHERE user_id = ?', [userId]);

    res.render('student/profile', {
      title: 'Hồ sơ người dùng - LMS Online',
      user: users[0],
      enrolledCount: stats[0].enrolled_count
    });
  } catch (err) {
    console.error(`[PROFILE-ERROR] Lỗi xem hồ sơ: ${err.message}`);
    res.redirect('/');
  }
});

module.exports = router;
