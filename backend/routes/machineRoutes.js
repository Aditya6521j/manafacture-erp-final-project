const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/machineController');

const router = express.Router();
router.use(protect);

router.get('/all', ctrl.all);
router.get('/utilization/summary', ctrl.utilization);
router.patch('/:id/status', permit('machine:update_status'), ctrl.updateStatus);
router.post('/:id/maintenance', permit('machine:view'), ctrl.scheduleMaintenance);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('production:create'), ctrl.create);
router.put('/:id', permit('production:update'), ctrl.update);
router.delete('/:id', permit('production:delete'), ctrl.remove);

module.exports = router;
