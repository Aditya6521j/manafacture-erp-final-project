const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/scheduleController');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('schedule:create'), ctrl.create);
router.put('/:id', permit('schedule:update'), ctrl.update);
router.delete('/:id', permit('schedule:delete'), ctrl.remove);

module.exports = router;
