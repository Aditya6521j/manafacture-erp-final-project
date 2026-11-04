const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/inspectionController');

const router = express.Router();
router.use(protect);

router.get('/stats', ctrl.stats);
router.patch('/:id/approve', permit('quality:approve'), ctrl.decide);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('quality:create'), ctrl.create);
router.put('/:id', permit('quality:update'), ctrl.update);
router.delete('/:id', permit('quality:update'), ctrl.remove);

module.exports = router;
