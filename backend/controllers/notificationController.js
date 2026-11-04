const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { runSystemChecks } = require('../services/notificationService');

/** Notifications visible to the current role */
function roleFilter(user) {
  if (user.role === 'Admin') return {};
  return { $or: [{ targetRoles: { $size: 0 } }, { targetRoles: user.role }, { targetRoles: { $exists: false } }] };
}

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const filter = { ...roleFilter(req.user) };
  if (req.query.type && req.query.type !== 'all') filter.type = req.query.type;
  if (req.query.unread === 'true') filter.readBy = { $ne: req.user._id };

  const [data, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...roleFilter(req.user), readBy: { $ne: req.user._id } }),
  ]);

  res.json({
    success: true,
    data: data.map((n) => ({ ...n, isRead: (n.readBy || []).some((id) => String(id) === String(req.user._id)) })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1, unread },
  });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ ...roleFilter(req.user), readBy: { $ne: req.user._id } });
  const latest = await Notification.find({ ...roleFilter(req.user) }).sort({ createdAt: -1 }).limit(5).lean();
  res.json({
    success: true,
    data: {
      count,
      latest: latest.map((n) => ({ ...n, isRead: (n.readBy || []).some((id) => String(id) === String(req.user._id)) })),
    },
  });
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new ApiError(404, 'Notification not found.');
  if (!notification.readBy.some((id) => String(id) === String(req.user._id))) {
    notification.readBy.push(req.user._id);
    await notification.save();
  }
  res.json({ success: true, message: 'Notification marked as read.' });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const notifications = await Notification.find(roleFilter(req.user));
  await Promise.all(
    notifications.map((n) => {
      if (!n.readBy.some((id) => String(id) === String(req.user._id))) {
        n.readBy.push(req.user._id);
        return n.save();
      }
      return null;
    })
  );
  res.json({ success: true, message: 'All notifications marked as read.' });
});

exports.remove = asyncHandler(async (req, res) => {
  const n = await Notification.findByIdAndDelete(req.params.id);
  if (!n) throw new ApiError(404, 'Notification not found.');
  res.json({ success: true, message: 'Notification deleted.' });
});

/** POST /api/notifications/refresh — re-runs the alert engine (low stock, deadlines, breakdowns) */
exports.refresh = asyncHandler(async (req, res) => {
  const count = await runSystemChecks();
  res.json({ success: true, message: `Alert engine finished — ${count} alert(s) processed.` });
});
