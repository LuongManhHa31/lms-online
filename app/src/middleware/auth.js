// Middleware xác thực và phân quyền Admin/Student

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login?error=Vui+lòng+đăng+nhập+để+tiếp+tục');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('error', {
    title: 'Truy cập bị từ chối',
    message: 'Bạn không có quyền quản trị viên (Admin) để truy cập chức năng này.',
    statusCode: 403
  });
}

function isStudent(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'student') {
    return next();
  }
  return res.redirect('/auth/login?error=Chức+năng+dành+cho+học+viên');
}

// Middleware inject biến user vào mọi view EJS
function attachUserToLocals(req, res, next) {
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isStudent,
  attachUserToLocals
};
