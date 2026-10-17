const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// Xem nội dung bài học
router.get('/:id', isAuthenticated, async (req, res) => {
  const lessonId = req.params.id;
  const user = req.session.user;

  try {
    // Lấy thông tin bài học
    const [lessons] = await pool.query(`
      SELECT l.*, c.title as course_title, c.id as course_id
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ? LIMIT 1
    `, [lessonId]);

    if (lessons.length === 0) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy bài học',
        message: 'Bài học không tồn tại hoặc đã bị xóa.',
        statusCode: 404
      });
    }

    const currentLesson = lessons[0];

    // Nếu là Student, kiểm tra xem đã đăng ký khóa học này chưa
    if (user.role === 'student') {
      const [enrollment] = await pool.query(
        'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
        [user.id, currentLesson.course_id]
      );

      if (enrollment.length === 0) {
        return res.redirect(`/courses/${currentLesson.course_id}?error=Bạn+cần+đăng+ký+khóa+học+để+xem+nội+dung+bài+học!`);
      }

      if (enrollment[0].status === 'pending') {
        return res.redirect(`/courses/${currentLesson.course_id}?error=Đơn+đăng+ký+của+bạn+đang+chờ+Quản+trị+viên+xác+nhận+trước+khi+vào+học!`);
      }

      if (enrollment[0].status === 'rejected') {
        return res.redirect(`/courses/${currentLesson.course_id}?error=Đơn+đăng+ký+khóa+học+của+bạn+đã+bị+từ+chối.`);
      }
    }

    // Lấy toàn bộ danh sách bài học của khóa này để hiển thị sidebar
    const [allLessons] = await pool.query(`
      SELECT id, title, order_num, duration_minutes
      FROM lessons
      WHERE course_id = ?
      ORDER BY order_num ASC, id ASC
    `, [currentLesson.course_id]);

    // Lấy tiến độ các bài học đã hoàn thành của user
    const [completedRows] = await pool.query(`
      SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND is_completed = 1
    `, [user.id]);
    const completedIds = completedRows.map(r => r.lesson_id);

    // Xác định bài học trước (Previous) và bài học kế tiếp (Next)
    const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    res.render('lessons/view', {
      title: `${currentLesson.title} - ${currentLesson.course_title}`,
      lesson: currentLesson,
      allLessons,
      completedIds,
      prevLesson,
      nextLesson,
      isCompleted: completedIds.includes(currentLesson.id)
    });
  } catch (err) {
    console.error(`[LESSON-ERROR] Lỗi tải bài học ${lessonId}: ${err.message}`);
    res.status(500).render('error', {
      title: 'Lỗi máy chủ',
      message: 'Không thể mở bài học lúc này.',
      statusCode: 500
    });
  }
});

// Đánh dấu hoàn thành bài học
router.post('/:id/complete', isAuthenticated, async (req, res) => {
  const lessonId = req.params.id;
  const userId = req.session.user.id;

  try {
    const [existing] = await pool.query(
      'SELECT id, is_completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1',
      [userId, lessonId]
    );

    if (existing.length > 0) {
      // Đã có bản ghi, chuyển trạng thái
      const newStatus = existing[0].is_completed ? 0 : 1;
      await pool.query(
        'UPDATE lesson_progress SET is_completed = ?, completed_at = NOW() WHERE id = ?',
        [newStatus, existing[0].id]
      );
    } else {
      // Thêm mới
      await pool.query(
        'INSERT INTO lesson_progress (user_id, lesson_id, is_completed) VALUES (?, ?, 1)',
        [userId, lessonId]
      );
    }

    // Chuyển hướng quay lại bài học hoặc bài kế tiếp
    const { next_id } = req.body;
    if (next_id) {
      return res.redirect(`/lessons/${next_id}`);
    }
    res.redirect(`/lessons/${lessonId}`);
  } catch (err) {
    console.error(`[PROGRESS-ERROR] Lỗi cập nhật tiến độ bài học: ${err.message}`);
    res.redirect(`/lessons/${lessonId}`);
  }
});

module.exports = router;
