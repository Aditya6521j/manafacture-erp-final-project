const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/supplierController');

const router = express.Router();
router.use(protect);

router.get('/all', ctrl.all);
router.get('/', ctrl.list);
router.post('/', permit('supplier:create'), ctrl.create);
router.put('/:id', permit('supplier:update'), ctrl.update);
router.delete('/:id', permit('supplier:delete'), ctrl.remove);

module.exports = router;
