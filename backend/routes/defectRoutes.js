const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, permit } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../config/env');
const ctrl = require('../controllers/defectController');

const router = express.Router();
router.use(protect);

// Image upload (defect evidence)
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `defect-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|jpg|webp)/.test(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG or WEBP images are allowed'), ok);
  },
});

router.get('/stats/analysis', ctrl.stats);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('defect:create'), upload.array('images', 3), ctrl.create);
router.put('/:id', permit('defect:update'), upload.array('images', 3), ctrl.update);
router.delete('/:id', permit('defect:update'), ctrl.remove);

module.exports = router;
