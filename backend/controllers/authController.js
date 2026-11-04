const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const { PERMISSIONS } = require('../config/permissions');

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  department: user.department,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  permissions: PERMISSIONS[user.role] || [],
});

/** POST /api/auth/register — self service registration (Machine Operator by default) */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, department } = req.body;

  const exists = await User.findOne({ email: String(email || '').toLowerCase() });
  if (exists) throw new ApiError(409, 'An account with this email already exists.');

  // Only an authenticated admin may create elevated roles
  const requestedRole = role && req.user?.role === 'Admin' ? role : 'Machine Operator';

  const user = await User.create({ name, email, password, role: requestedRole, phone, department: department || undefined });
  const populated = await user.populate('department', 'name code');

  res.status(201).json({
    success: true,
    message: 'Account created successfully. You can now log in.',
    data: { token: signToken(user), user: publicUser(populated) },
  });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password').populate('department', 'name code');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Please contact the administrator.');

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({ success: true, message: `Welcome back, ${user.name.split(' ')[0]}!`, data: { token: signToken(user), user: publicUser(user) } });
});

/** GET /api/auth/me */
exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('department', 'name code');
  res.json({ success: true, data: publicUser(user) });
});

/** PUT /api/auth/profile */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department } = req.body;
  const user = await User.findById(req.user._id);
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined) user.department = department || undefined;
  await user.save({ validateBeforeSave: false });
  const populated = await user.populate('department', 'name code');
  res.json({ success: true, message: 'Profile updated successfully.', data: publicUser(populated) });
});

/** PUT /api/auth/password */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Current and new password are required.');
  if (String(newPassword).length < 6) throw new ApiError(400, 'New password must be at least 6 characters long.');

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw new ApiError(401, 'Current password is incorrect.');
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully.' });
});

/** GET /api/auth/roles — role list for registration/profile dropdowns */
exports.roles = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true }).select('name code').lean();
  res.json({
    success: true,
    data: {
      roles: Object.keys(PERMISSIONS),
      departments,
      permissions: PERMISSIONS,
    },
  });
});
