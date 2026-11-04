const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

const router = express.Router();
router.use(protect);

router.get('/types', ctrl.types);
router.get('/:type', ctrl.preview);
router.get('/:type/download', permit('report:download'), ctrl.download);

module.exports = router;
