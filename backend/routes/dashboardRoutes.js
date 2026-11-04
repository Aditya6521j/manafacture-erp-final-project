const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

const router = express.Router();
router.use(protect);

router.get('/overview', ctrl.overview);
router.get('/stats', ctrl.stats);
router.get('/charts', ctrl.charts);

module.exports = router;
