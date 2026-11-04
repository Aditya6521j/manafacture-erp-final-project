const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/productionOrderController');

const router = express.Router();
router.use(protect);

router.get('/stats/summary', ctrl.stats);
router.patch('/:id/status', permit('production:update'), ctrl.updateStatus);
router.patch('/:id/progress', ctrl.updateProgress);
router.patch('/:id/consume-materials', permit('production:update'), ctrl.consumeMaterials);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('production:create'), ctrl.create);
router.put('/:id', permit('production:update'), ctrl.update);
router.delete('/:id', permit('production:delete'), ctrl.remove);

module.exports = router;
