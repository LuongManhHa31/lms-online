const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// Danh sách tất cả các khóa học (có tìm kiếm và lọc theo danh mục)
router.get('/', async (req, res) => {
  const { q, category } = req.query;

  try {
    let query = `
      SELECT c.*, cat.name as category_name, 
             COUNT(DISTINCT l.id) as total_lessons,
             COUNT(DISTINCT e.id) as total_students
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE 1=1
    `;
    const params = [];

    if (q && q.trim()) {
      query += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.instructor LIKE ?)`;
      const search = `%${q.trim()}%`;
      params.push(search, search, search);
    }

    if (category && category !== 'all') {
      query += ` AND c.category_id = ?`;
      params.push(category);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const [courses] = await pool.query(query, params);
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY name ASC');

    res.render('courses/index', {
      title: 'Danh sách Khóa học - LMS Online',
      courses,
      categories,
      selectedCategory: category || 'all',
      searchQuery: q || ''
    });
  } catch (err) {
    console.error(`[COURSE-ERROR] Lỗi tải danh sách khóa học: ${err.message}`);
    res.status(500).render('error', {
      title: 'Lỗi máy chủ',
      message: 'Không thể tải danh sách khóa học lúc này.',
      statusCode: 500
    });
  }
});

// Xem chi tiết khóa học và danh sách bài học
router.get('/:id', async (req, res) => {
  const courseId = req.params.id;
  const userId = req.session && req.session.user ? req.session.user.id : null;

  try {
    const [courses] = await pool.query(`
      SELECT c.*, cat.name as category_name, u.full_name as creator_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ? LIMIT 1
    `, [courseId]);

    if (courses.length === 0) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy khóa học',
        message: 'Khóa học bạn yêu cầu không tồn tại hoặc đã bị xóa.',
        statusCode: 404
      });
    }

    const course = courses[0];

    // Lấy danh sách bài học theo thứ tự order_num
    const [lessons] = await pool.query(`
      SELECT id, title, order_num, duration_minutes, created_at
      FROM lessons
      WHERE course_id = ?
      ORDER BY order_num ASC, id ASC
    `, [courseId]);

    // Kiểm tra xem người dùng hiện tại đã đăng ký khóa học này chưa
    let isEnrolled = false;
    let enrollmentStatus = null;
    let completedLessonIds = [];

    if (userId) {
      const [enrollment] = await pool.query(`
        SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1
      `, [userId, courseId]);
      if (enrollment.length > 0) {
        enrollmentStatus = enrollment[0].status;
        isEnrolled = enrollment[0].status === 'active' || enrollment[0].status === 'completed';
      }

      // Lấy danh sách bài học đã hoàn thành
      const [progress] = await pool.query(`
        SELECT lp.lesson_id 
        FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.user_id = ? AND l.course_id = ? AND lp.is_completed = 1
      `, [userId, courseId]);
      completedLessonIds = progress.map(p => p.lesson_id);
    }

    res.render('courses/detail', {
      title: `${course.title} - LMS Online`,
      course,
      lessons,
      isEnrolled,
      enrollmentStatus,
      completedLessonIds,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(`[COURSE-ERROR] Lỗi xem chi tiết khóa học ${courseId}: ${err.message}`);
    res.status(500).render('error', {
      title: 'Lỗi máy chủ',
      message: 'Đã có lỗi xảy ra khi tải chi tiết khóa học.',
      statusCode: 500
    });
  }
});

// Đăng ký tham gia khóa học (Chức năng dành cho Học viên)
router.post('/:id/enroll', isAuthenticated, async (req, res) => {
  const courseId = req.params.id;
  const userId = req.session.user.id;

  try {
    // Kiểm tra khóa học có tồn tại
    const [course] = await pool.query('SELECT title FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (course.length === 0) {
      return res.redirect(`/courses?error=Khóa+học+không+tồn+tại`);
    }

    // Kiểm tra xem đã đăng ký chưa
    const [existing] = await pool.query(
      'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
      [userId, courseId]
    );

    if (existing.length > 0) {
      if (existing[0].status === 'pending') {
        return res.redirect(`/courses/${courseId}?error=Yêu+cầu+đăng+ký+của+bạn+đang+chờ+Quản+trị+viên+xác+nhận!`);
      }
      return res.redirect(`/courses/${courseId}?error=Bạn+đã+đăng+ký+khóa+học+này+rồi!`);
    }

    // Thêm đăng ký mới với trạng thái pending (Chờ quản trị viên xác nhận)
    await pool.query(
      'INSERT INTO enrollments (user_id, course_id, status) VALUES (?, ?, "pending")',
      [userId, courseId]
    );

    console.info(`[ENROLL-LOG] Học viên [${req.session.user.username}] đăng ký khóa học [${course[0].title}] (ID: ${courseId}) - Chờ duyệt`);

    res.redirect(`/courses/${courseId}?success=Đăng+ký+khóa+học+thành+công!+Yêu+cầu+đang+chờ+Ban+Quản+Trị+xác+nhận.`);
  } catch (err) {
    console.error(`[ENROLL-ERROR] Lỗi đăng ký khóa học: ${err.message}`);
    res.redirect(`/courses/${courseId}?error=Không+thể+đăng+ký+lúc+này.+Vui+lòng+thử+lại.`);
  }
});

module.exports = router;
