const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Trang Đăng nhập
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/student/my-courses');
  }
  res.render('auth/login', {
    title: 'Đăng nhập - Hệ Thống LMS',
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// Xử lý Đăng nhập
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('auth/login', {
      title: 'Đăng nhập - Hệ Thống LMS',
      error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      success: null
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username.trim(), username.trim()]
    );

    if (rows.length === 0) {
      console.warn(`[AUTH-LOG] Đăng nhập thất bại: Tài khoản không tồn tại [${username}]`);
      return res.render('auth/login', {
        title: 'Đăng nhập - Hệ Thống LMS',
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        success: null
      });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.warn(`[AUTH-LOG] Đăng nhập thất bại: Sai mật khẩu cho user [${user.username}]`);
      return res.render('auth/login', {
        title: 'Đăng nhập - Hệ Thống LMS',
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        success: null
      });
    }

    // Thiết lập phiên đăng nhập (Session)
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      avatar: user.avatar
    };

    console.info(`[AUTH-LOG] Đăng nhập thành công: User [${user.username}] | Vai trò: [${user.role}]`);

    const returnUrl = req.session.returnTo || (user.role === 'admin' ? '/admin/dashboard' : '/student/my-courses');
    delete req.session.returnTo;
    res.redirect(returnUrl);
  } catch (err) {
    console.error(`[AUTH-ERROR] Lỗi đăng nhập: ${err.message}`);
    res.render('auth/login', {
      title: 'Đăng nhập - Hệ Thống LMS',
      error: 'Có lỗi xảy ra trong quá trình xử lý, vui lòng thử lại.',
      success: null
    });
  }
});

// Trang Đăng ký
router.get('/register', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', {
    title: 'Đăng ký tài khoản - Hệ Thống LMS',
    error: req.query.error || null,
    values: {}
  });
});

// Xử lý Đăng ký (mặc định tạo vai trò 'student')
router.post('/register', async (req, res) => {
  const { username, email, full_name, password, confirm_password } = req.body;
  const values = { username, email, full_name };

  if (!username || !email || !full_name || !password) {
    return res.render('auth/register', {
      title: 'Đăng ký tài khoản - Hệ Thống LMS',
      error: 'Vui lòng điền đầy đủ các trường bắt buộc.',
      values
    });
  }

  if (password !== confirm_password) {
    return res.render('auth/register', {
      title: 'Đăng ký tài khoản - Hệ Thống LMS',
      error: 'Mật khẩu xác nhận không khớp.',
      values
    });
  }

  if (password.length < 6) {
    return res.render('auth/register', {
      title: 'Đăng ký tài khoản - Hệ Thống LMS',
      error: 'Mật khẩu phải chứa ít nhất 6 ký tự.',
      values
    });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username.trim(), email.trim()]
    );

    if (existing.length > 0) {
      const field = existing[0].username === username.trim() ? 'Tên đăng nhập' : 'Email';
      return res.render('auth/register', {
        title: 'Đăng ký tài khoản - Hệ Thống LMS',
        error: `${field} này đã được sử dụng. Vui lòng chọn thông tin khác.`,
        values
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, 'student')`,
      [username.trim(), email.trim(), hashedPassword, full_name.trim()]
    );

    console.info(`[AUTH-LOG] Đăng ký thành công: User mới ID=${result.insertId}, username=[${username.trim()}]`);

    // Tự động đăng nhập
    req.session.user = {
      id: result.insertId,
      username: username.trim(),
      email: email.trim(),
      full_name: full_name.trim(),
      role: 'student',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    };

    res.redirect('/student/my-courses?welcome=1');
  } catch (err) {
    console.error(`[AUTH-ERROR] Lỗi đăng ký tài khoản: ${err.message}`);
    res.render('auth/register', {
      title: 'Đăng ký tài khoản - Hệ Thống LMS',
      error: 'Lỗi hệ thống khi đăng ký. Vui lòng thử lại sau.',
      values
    });
  }
});

// Đăng xuất
router.get('/logout', (req, res) => {
  if (req.session && req.session.user) {
    console.info(`[AUTH-LOG] User [${req.session.user.username}] đăng xuất.`);
    req.session.destroy(() => {
      res.redirect('/auth/login?success=Đã+đăng+xuất+thành+công');
    });
  } else {
    res.redirect('/');
  }
});

module.exports = router;
