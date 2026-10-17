const client = require('prom-client');

// Khởi tạo Prometheus Registry
const register = new client.Registry();

// Bật các metrics mặc định của Node.js (CPU, Memory, Garbage Collection, v.v.)
client.collectDefaultMetrics({
  register,
  prefix: 'lms_'
});

// Metric đo tổng số HTTP request
const httpRequestCounter = new client.Counter({
  name: 'lms_http_requests_total',
  help: 'Tổng số HTTP requests gửi tới ứng dụng LMS',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Metric đo độ trễ (latency) của từng HTTP request
const httpRequestDuration = new client.Histogram({
  name: 'lms_http_request_duration_seconds',
  help: 'Thời gian phản hồi của HTTP requests tính theo giây',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

// Metric đo số người dùng đang hoạt động
const activeSessionsGauge = new client.Gauge({
  name: 'lms_active_users_gauge',
  help: 'Ước lượng số phiên hoạt động hiện tại trong hệ thống',
  registers: [register]
});

// Middleware thu thập metrics cho từng request
function metricsMiddleware(req, res, next) {
  // Bỏ qua scraping /metrics và static files để tránh làm nhiễu dữ liệu
  if (req.path === '/metrics' || req.path.startsWith('/public') || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.baseUrl + (req.route ? req.route.path : req.path);

    httpRequestCounter.inc({
      method: req.method,
      route: route || req.path,
      status_code: res.statusCode
    });

    httpRequestDuration.observe({
      method: req.method,
      route: route || req.path,
      status_code: res.statusCode
    }, durationInSeconds);
  });

  next();
}

// Controller phục vụ endpoint /metrics cho Prometheus scrape
async function getMetrics(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
}

module.exports = {
  metricsMiddleware,
  getMetrics,
  activeSessionsGauge
};
