const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/maintenanceController');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.list);
router.post('/', permit('machine:view'), ctrl.create);
router.put('/:id', permit('machine:view'), ctrl.update);
router.delete('/:id', permit('production:delete'), ctrl.remove);

module.exports = router;
