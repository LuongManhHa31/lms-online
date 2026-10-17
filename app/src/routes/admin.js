const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Toàn bộ router này yêu cầu quyền Admin
router.use(isAuthenticated, isAdmin);

// 1. Dashboard Thống Kê Tổng Quan
router.get(['/', '/dashboard'], async (req, res) => {
  try {
    const [userStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as total_students,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as total_admins
      FROM users
    `);

    const [courseStats] = await pool.query('SELECT COUNT(*) as total_courses FROM courses');
    const [lessonStats] = await pool.query('SELECT COUNT(*) as total_lessons FROM lessons');
    const [enrollmentStats] = await pool.query('SELECT COUNT(*) as total_enrollments FROM enrollments');
    const [pendingStats] = await pool.query("SELECT COUNT(*) as pending_count FROM enrollments WHERE status = 'pending'");

    // Lấy 8 lượt đăng ký khóa học gần nhất
    const [recentEnrollments] = await pool.query(`
      SELECT e.id, e.enrolled_at, e.status, u.full_name as user_name, u.username, c.title as course_title
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      ORDER BY CASE WHEN e.status = 'pending' THEN 1 ELSE 2 END, e.enrolled_at DESC LIMIT 8
    `);

    res.render('admin/dashboard', {
      title: 'Bảng Điều Khiển Quản Trị - LMS Online',
      stats: {
        totalUsers: userStats[0].total_users || 0,
        totalStudents: userStats[0].total_students || 0,
        totalAdmins: userStats[0].total_admins || 0,
        totalCourses: courseStats[0].total_courses || 0,
        totalLessons: lessonStats[0].total_lessons || 0,
        totalEnrollments: enrollmentStats[0].total_enrollments || 0,
        pendingEnrollments: pendingStats[0].pending_count || 0
      },
      recentEnrollments
    });
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi tải Dashboard: ${err.message}`);
    res.status(500).render('error', {
      title: 'Lỗi quản trị',
      message: 'Không thể tải bảng điều khiển quản trị.',
      statusCode: 500
    });
  }
});

// 2. Quản Lý Khóa Học
router.get('/courses', async (req, res) => {
  try {
    const [courses] = await pool.query(`
      SELECT c.*, cat.name as category_name,
             COUNT(DISTINCT l.id) as lesson_count,
             COUNT(DISTINCT e.id) as student_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN lessons l ON c.id = l.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.render('admin/courses', {
      title: 'Quản lý Khóa học - LMS Admin',
      courses,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi danh sách khóa học: ${err.message}`);
    res.redirect('/admin/dashboard');
  }
});

// Form tạo khóa học mới
router.get('/courses/new', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.render('admin/course-form', {
      title: 'Thêm Khóa học mới - LMS Admin',
      course: null,
      categories,
      action: '/admin/courses/new'
    });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

// Xử lý tạo khóa học mới
router.post('/courses/new', async (req, res) => {
  const { title, category_id, description, instructor, thumbnail_url, price, level } = req.body;
  const creatorId = req.session.user.id;

  try {
    await pool.query(`
      INSERT INTO courses (title, category_id, description, instructor, thumbnail_url, price, level, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      category_id || null,
      description.trim(),
      instructor.trim() || 'Giảng viên LMS',
      thumbnail_url.trim() || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600',
      parseFloat(price) || 0,
      level || 'Cơ bản',
      creatorId
    ]);

    console.info(`[ADMIN-LOG] Admin [${req.session.user.username}] đã tạo khóa học mới: "${title}"`);
    res.redirect('/admin/courses?success=Thêm+khóa+học+mới+thành+công!');
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi tạo khóa học: ${err.message}`);
    res.redirect('/admin/courses/new?error=' + encodeURIComponent(err.message));
  }
});

// Form chỉnh sửa khóa học
router.get('/courses/:id/edit', async (req, res) => {
  const courseId = req.params.id;
  try {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (courses.length === 0) return res.redirect('/admin/courses?error=Khóa+học+không+tồn+tại');

    const [categories] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.render('admin/course-form', {
      title: 'Chỉnh sửa Khóa học - LMS Admin',
      course: courses[0],
      categories,
      action: `/admin/courses/${courseId}/edit`
    });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

// Xử lý cập nhật khóa học
router.post('/courses/:id/edit', async (req, res) => {
  const courseId = req.params.id;
  const { title, category_id, description, instructor, thumbnail_url, price, level } = req.body;

  try {
    await pool.query(`
      UPDATE courses 
      SET title = ?, category_id = ?, description = ?, instructor = ?, thumbnail_url = ?, price = ?, level = ?
      WHERE id = ?
    `, [
      title.trim(),
      category_id || null,
      description.trim(),
      instructor.trim(),
      thumbnail_url.trim(),
      parseFloat(price) || 0,
      level,
      courseId
    ]);

    console.info(`[ADMIN-LOG] Cập nhật khóa học ID=${courseId}`);
    res.redirect('/admin/courses?success=Cập+nhật+khóa+học+thành+công!');
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi sửa khóa học: ${err.message}`);
    res.redirect(`/admin/courses/${courseId}/edit?error=` + encodeURIComponent(err.message));
  }
});

// Xóa khóa học
router.post('/courses/:id/delete', async (req, res) => {
  const courseId = req.params.id;
  try {
    await pool.query('DELETE FROM courses WHERE id = ?', [courseId]);
    console.info(`[ADMIN-LOG] Đã xóa khóa học ID=${courseId}`);
    res.redirect('/admin/courses?success=Đã+xóa+khóa+học+thành+công!');
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi xóa khóa học: ${err.message}`);
    res.redirect('/admin/courses?error=Không+thể+xóa+khóa+học');
  }
});

// 3. Quản Lý Bài Học Của Khóa Học
router.get('/courses/:courseId/lessons', async (req, res) => {
  const courseId = req.params.courseId;
  try {
    const [courses] = await pool.query('SELECT id, title FROM courses WHERE id = ?', [courseId]);
    if (courses.length === 0) return res.redirect('/admin/courses');

    const [lessons] = await pool.query(`
      SELECT * FROM lessons WHERE course_id = ? ORDER BY order_num ASC, id ASC
    `, [courseId]);

    res.render('admin/lessons', {
      title: `Bài học: ${courses[0].title} - LMS Admin`,
      course: courses[0],
      lessons,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

// Form thêm bài học
router.get('/courses/:courseId/lessons/new', async (req, res) => {
  const courseId = req.params.courseId;
  try {
    const [courses] = await pool.query('SELECT id, title FROM courses WHERE id = ?', [courseId]);
    if (courses.length === 0) return res.redirect('/admin/courses');

    res.render('admin/lesson-form', {
      title: `Thêm bài học cho: ${courses[0].title}`,
      course: courses[0],
      lesson: null,
      action: `/admin/courses/${courseId}/lessons/new`
    });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

// Xử lý thêm bài học
router.post('/courses/:courseId/lessons/new', async (req, res) => {
  const courseId = req.params.courseId;
  const { title, order_num, duration_minutes, video_url, content } = req.body;

  try {
    await pool.query(`
      INSERT INTO lessons (course_id, title, order_num, duration_minutes, video_url, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      courseId,
      title.trim(),
      parseInt(order_num) || 1,
      parseInt(duration_minutes) || 15,
      video_url.trim() || null,
      content.trim()
    ]);

    console.info(`[ADMIN-LOG] Thêm bài học mới vào khóa ID=${courseId}: "${title}"`);
    res.redirect(`/admin/courses/${courseId}/lessons?success=Thêm+bài+học+thành+công!`);
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi thêm bài học: ${err.message}`);
    res.redirect(`/admin/courses/${courseId}/lessons/new?error=` + encodeURIComponent(err.message));
  }
});

// Form sửa bài học
router.get('/lessons/:id/edit', async (req, res) => {
  const lessonId = req.params.id;
  try {
    const [lessons] = await pool.query(`
      SELECT l.*, c.title as course_title, c.id as course_id
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = ?
    `, [lessonId]);

    if (lessons.length === 0) return res.redirect('/admin/courses');

    const lesson = lessons[0];
    res.render('admin/lesson-form', {
      title: `Sửa bài học: ${lesson.title}`,
      course: { id: lesson.course_id, title: lesson.course_title },
      lesson,
      action: `/admin/lessons/${lessonId}/edit`
    });
  } catch (err) {
    res.redirect('/admin/courses');
  }
});

// Xử lý sửa bài học
router.post('/lessons/:id/edit', async (req, res) => {
  const lessonId = req.params.id;
  const { title, order_num, duration_minutes, video_url, content } = req.body;

  try {
    const [current] = await pool.query('SELECT course_id FROM lessons WHERE id = ?', [lessonId]);
    if (current.length === 0) return res.redirect('/admin/courses');

    await pool.query(`
      UPDATE lessons 
      SET title = ?, order_num = ?, duration_minutes = ?, video_url = ?, content = ?
      WHERE id = ?
    `, [
      title.trim(),
      parseInt(order_num) || 1,
      parseInt(duration_minutes) || 15,
      video_url.trim() || null,
      content.trim(),
      lessonId
    ]);

    console.info(`[ADMIN-LOG] Cập nhật bài học ID=${lessonId}`);
    res.redirect(`/admin/courses/${current[0].course_id}/lessons?success=Cập+nhật+bài+học+thành+công!`);
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi sửa bài học: ${err.message}`);
    res.redirect(`/admin/lessons/${lessonId}/edit?error=` + encodeURIComponent(err.message));
  }
});

// Xóa bài học
router.post('/lessons/:id/delete', async (req, res) => {
  const lessonId = req.params.id;
  try {
    const [current] = await pool.query('SELECT course_id FROM lessons WHERE id = ?', [lessonId]);
    if (current.length > 0) {
      const courseId = current[0].course_id;
      await pool.query('DELETE FROM lessons WHERE id = ?', [lessonId]);
      console.info(`[ADMIN-LOG] Xóa bài học ID=${lessonId}`);
      return res.redirect(`/admin/courses/${courseId}/lessons?success=Đã+xóa+bài+học!`);
    }
    res.redirect('/admin/courses');
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi xóa bài học: ${err.message}`);
    res.redirect('/admin/courses');
  }
});

// 4. Quản Lý Người Dùng (Phân quyền Admin / Student)
router.get('/users', async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.created_at,
             COUNT(DISTINCT e.id) as enrolled_courses_count
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.render('admin/users', {
      title: 'Quản lý Người dùng & Phân quyền - LMS Admin',
      users,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    res.redirect('/admin/dashboard');
  }
});

// Cập nhật vai trò (Admin / Student)
router.post('/users/:id/role', async (req, res) => {
  const targetUserId = req.params.id;
  const { role } = req.body;

  if (!['admin', 'student'].includes(role)) {
    return res.redirect('/admin/users?error=Vai+trò+không+hợp+lệ');
  }

  // Không cho phép tự đổi quyền của chính mình
  if (parseInt(targetUserId, 10) === req.session.user.id) {
    return res.redirect('/admin/users?error=Bạn+không+thể+tự+thay+đổi+vai+trò+của+chính+mình!');
  }

  try {
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId]);
    console.info(`[ADMIN-LOG] Đã đổi vai trò user ID=${targetUserId} thành ${role}`);
    res.redirect('/admin/users?success=Cập+nhật+phân+quyền+thành+công!');
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi đổi quyền: ${err.message}`);
    res.redirect('/admin/users?error=Lỗi+hệ+thống+khi+phân+quyền');
  }
});

// Xóa người dùng
router.post('/users/:id/delete', async (req, res) => {
  const targetUserId = req.params.id;

  if (parseInt(targetUserId, 10) === req.session.user.id) {
    return res.redirect('/admin/users?error=Không+thể+xóa+tài+khoản+đang+đăng+nhập!');
  }

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [targetUserId]);
    console.info(`[ADMIN-LOG] Đã xóa người dùng ID=${targetUserId}`);
    res.redirect('/admin/users?success=Đã+xóa+người+dùng+thành+công!');
  } catch (err) {
    res.redirect('/admin/users?error=Không+thể+xóa+người+dùng');
  }
});

// 5. Quản Lý Đăng Ký Khóa Học (Enrollments) & Xác Nhận Học Viên
router.get('/enrollments', async (req, res) => {
  const selectedStatus = req.query.status || 'all';

  try {
    // Đếm số lượng theo từng trạng thái
    const [counts] = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
      FROM enrollments
    `);

    let query = `
      SELECT e.id, e.enrolled_at, e.status,
             u.full_name as user_name, u.username, u.email as user_email, u.avatar as user_avatar,
             c.title as course_title, c.id as course_id
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
    `;
    const params = [];

    if (selectedStatus && selectedStatus !== 'all') {
      query += ' WHERE e.status = ?';
      params.push(selectedStatus);
    }

    // Đưa các đơn chờ xác nhận (pending) lên đầu danh sách để admin xử lý nhanh
    query += ' ORDER BY CASE WHEN e.status = "pending" THEN 1 ELSE 2 END, e.enrolled_at DESC';

    const [enrollments] = await pool.query(query, params);

    res.render('admin/enrollments', {
      title: 'Quản lý & Xác nhận Đăng ký Khóa học - LMS Admin',
      enrollments,
      selectedStatus,
      counts: counts[0] || { total_count: 0, pending_count: 0, active_count: 0, completed_count: 0, rejected_count: 0 },
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(`[ADMIN-ENROLL-ERROR] Lỗi tải danh sách đăng ký: ${err.message}`);
    res.redirect('/admin/dashboard');
  }
});

// Xác nhận / Phê duyệt học viên đăng ký khóa học
router.post('/enrollments/:id/approve', async (req, res) => {
  const enrollmentId = req.params.id;

  try {
    const [current] = await pool.query(`
      SELECT e.id, u.full_name, u.username, c.title as course_title
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      WHERE e.id = ? LIMIT 1
    `, [enrollmentId]);

    if (current.length === 0) {
      return res.redirect('/admin/enrollments?error=Lượt+đăng+ký+không+tồn+tại');
    }

    await pool.query('UPDATE enrollments SET status = "active" WHERE id = ?', [enrollmentId]);
    console.info(`[ADMIN-LOG] Admin [${req.session.user.username}] ĐÃ PHÊ DUYỆT học viên [${current[0].full_name}] vào khóa "${current[0].course_title}"`);

    const backUrl = req.header('Referer') || '/admin/enrollments';
    res.redirect(backUrl.includes('?') ? `${backUrl}&success=Đã+xác+nhận+thành+công+học+viên+vào+khóa+học!` : `${backUrl}?success=Đã+xác+nhận+thành+công+học+viên+vào+khóa+học!`);
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi duyệt đăng ký: ${err.message}`);
    res.redirect('/admin/enrollments?error=Lỗi+hệ+thống+khi+phê+duyệt+đăng+ký');
  }
});

// Từ chối đơn đăng ký khóa học
router.post('/enrollments/:id/reject', async (req, res) => {
  const enrollmentId = req.params.id;

  try {
    await pool.query('UPDATE enrollments SET status = "rejected" WHERE id = ?', [enrollmentId]);
    console.info(`[ADMIN-LOG] Admin [${req.session.user.username}] ĐÃ TỪ CHỐI đăng ký ID=${enrollmentId}`);

    const backUrl = req.header('Referer') || '/admin/enrollments';
    res.redirect(backUrl.includes('?') ? `${backUrl}&success=Đã+từ+chối+đơn+đăng+ký+này.` : `${backUrl}?success=Đã+từ+chối+đơn+đăng+ký+này.`);
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi từ chối đăng ký: ${err.message}`);
    res.redirect('/admin/enrollments?error=Lỗi+khi+từ+chối+đăng+ký');
  }
});

// Phê duyệt TẤT CẢ các đơn đang chờ xác nhận (1-Click Approve All)
router.post('/enrollments/approve-all', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE enrollments SET status = "active" WHERE status = "pending"');
    console.info(`[ADMIN-LOG] Admin [${req.session.user.username}] ĐÃ PHÊ DUYỆT TẤT CẢ (${result.affectedRows} đơn)`);
    res.redirect(`/admin/enrollments?success=Đã+phê+duyệt+toàn+bộ+${result.affectedRows}+đơn+đăng+ký+đang+chờ+xác+nhận!`);
  } catch (err) {
    console.error(`[ADMIN-ERROR] Lỗi phê duyệt tất cả: ${err.message}`);
    res.redirect('/admin/enrollments?error=Lỗi+khi+phê+duyệt+hàng+loạt');
  }
});

// Xóa hẳn lượt đăng ký khóa học
router.post('/enrollments/:id/delete', async (req, res) => {
  const enrollmentId = req.params.id;
  try {
    await pool.query('DELETE FROM enrollments WHERE id = ?', [enrollmentId]);
    console.info(`[ADMIN-LOG] Đã xóa vĩnh viễn đăng ký ID=${enrollmentId}`);
    res.redirect('/admin/enrollments?success=Đã+xóa+lượt+đăng+ký+khỏi+hệ+thống!');
  } catch (err) {
    res.redirect('/admin/enrollments?error=Lỗi+khi+xóa+đăng+ký');
  }
});

module.exports = router;
