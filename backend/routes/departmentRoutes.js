const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/departmentController');

const router = express.Router();
router.use(protect);

router.get('/all', ctrl.all);
router.get('/', ctrl.list);
router.post('/', authorize('Admin'), ctrl.create);
router.put('/:id', authorize('Admin'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.remove);

module.exports = router;
