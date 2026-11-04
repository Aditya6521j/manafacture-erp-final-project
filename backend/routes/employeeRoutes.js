const express = require('express');
const { protect, permit, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/employeeController');

const router = express.Router();
router.use(protect);

router.get('/stats/summary', ctrl.stats);
router.get('/all', ctrl.all);
router.post('/:id/tasks', permit('employee:assign'), ctrl.assignTask);
router.patch('/:id/tasks/:taskId', permit('employee:assign'), ctrl.updateTaskStatus);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', authorize('Admin', 'Production Manager'), ctrl.create);
router.put('/:id', authorize('Admin', 'Production Manager'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.remove);

module.exports = router;
