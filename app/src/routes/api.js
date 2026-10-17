const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Endpoint kiểm tra sức khỏe hệ thống (Health Check)
router.get('/health', async (req, res) => {
  let dbStatus = 'DOWN';
  let latencyMs = 0;

  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    latencyMs = Date.now() - start;
    dbStatus = 'UP';
  } catch (err) {
    dbStatus = `DOWN: ${err.message}`;
  }

  const memoryUsage = process.memoryUsage();

  const healthData = {
    status: dbStatus === 'UP' ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latencyMs
    },
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
    },
    environment: process.env.NODE_ENV || 'production'
  };

  res.status(dbStatus === 'UP' ? 200 : 503).json(healthData);
});

module.exports = router;
