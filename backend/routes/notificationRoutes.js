const express = require('express');
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

const router = express.Router();
router.use(protect);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.post('/refresh', ctrl.refresh);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
