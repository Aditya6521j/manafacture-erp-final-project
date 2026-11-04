const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/materialController');

const router = express.Router();
router.use(protect);

router.get('/all', ctrl.all);
router.get('/low-stock', ctrl.lowStock);
router.get('/stats', ctrl.stats);
router.post('/sync-requirements', permit('inventory:update'), ctrl.syncRequirements);
router.post('/:id/consume', permit('inventory:update'), ctrl.consume);
router.post('/:id/purchase', permit('inventory:purchase'), ctrl.purchase);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('inventory:create'), ctrl.create);
router.put('/:id', permit('inventory:update'), ctrl.update);
router.delete('/:id', permit('inventory:delete'), ctrl.remove);

module.exports = router;
