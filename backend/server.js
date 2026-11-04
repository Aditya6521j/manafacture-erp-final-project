const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { PORT, MONGO_URI, CLIENT_ORIGIN, NODE_ENV, UPLOAD_DIR } = require('./config/env');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { runSystemChecks } = require('./services/notificationService');

const app = express();

// ---------- Security & parsing ----------
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (NODE_ENV !== 'test') app.use(morgan('dev'));

// Throttle auth endpoints against brute force
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' } })
);

// Uploaded defect images
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ---------- API ----------
app.get('/api/health', (req, res) =>
  res.json({ success: true, status: 'ok', service: 'manufacturing-erp-api', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() })
);
app.use('/api', apiRoutes);

// ---------- Angular SPA (production build) ----------
// The Angular application builder writes to <outputPath>/browser
const publicDir = path.join(__dirname, 'public');
const clientDist = fs.existsSync(path.join(publicDir, 'browser', 'index.html'))
  ? path.join(publicDir, 'browser')
  : publicDir;
const indexHtml = path.join(clientDist, 'index.html');
app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
app.get(/^\/(?!api|uploads).*/, (req, res, next) => {
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  return next();
});

// ---------- Errors ----------
app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB(MONGO_URI);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ⚙  Manufacturing ERP API running on http://localhost:${PORT}`);
    console.log(`  ▸  Frontend build served from ${clientDist}`);
    console.log(`  ▸  Environment: ${NODE_ENV}\n`);
    // Kick off the alert engine once at boot (low stock / deadlines / breakdowns)
    runSystemChecks().then((n) => console.log(`[alerts] ${n} alert(s) evaluated at startup`)).catch(() => {});
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = app;
