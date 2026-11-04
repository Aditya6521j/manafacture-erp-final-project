const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');

/** GET /api/users */
exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['name', 'email'],
    extraFilters: ['role', 'isActive'],
  });
  const [data, total] = await Promise.all([
    User.find(filter).populate('department', 'name code').sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

/** POST /api/users (admin) */
exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department } = req.body;
  const exists = await User.findOne({ email: String(email || '').toLowerCase() });
  if (exists) throw new ApiError(409, 'A user with this email already exists.');
  const user = await User.create({ name, email, password, role, phone, department: department || undefined });
  res.status(201).json({ success: true, message: 'User created successfully.', data: await user.populate('department', 'name code') });
});

/** PUT /api/users/:id */
exports.update = asyncHandler(async (req, res) => {
  const { name, email, role, phone, department, isActive, password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  if (email && email.toLowerCase() !== user.email) {
    const dup = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
    if (dup) throw new ApiError(409, 'A user with this email already exists.');
    user.email = email;
  }
  if (name) user.name = name;
  if (role) user.role = role;
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined) user.department = department || undefined;
  if (isActive !== undefined) user.isActive = isActive;
  if (password) user.password = password;

  await user.save();
  res.json({ success: true, message: 'User updated successfully.', data: await user.populate('department', 'name code') });
});

/** DELETE /api/users/:id */
exports.remove = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot deactivate your own account.');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ success: true, message: 'User removed successfully.' });
});

/** GET /api/users/managers — users usable in assignee dropdowns */
exports.assignable = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = { isActive: true };
  if (role) filter.role = role;
  const users = await User.find(filter).select('name email role').sort({ name: 1 }).lean();
  res.json({ success: true, data: users });
});
