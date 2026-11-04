const express = require('express');
const { protect, permit } = require('../middleware/auth');
const ctrl = require('../controllers/productController');

const router = express.Router();
router.use(protect);

router.get('/all', ctrl.all);
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', permit('production:create'), ctrl.create);
router.put('/:id', permit('production:update'), ctrl.update);
router.delete('/:id', permit('production:delete'), ctrl.remove);

module.exports = router;
