const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/env');
const { can } = require('../config/permissions');
const ApiError = require('../utils/ApiError');

/** Verifies the Bearer JWT and attaches the current user to req.user */
async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Not authorized. Please log in to continue.');
    }
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const user = await User.findById(decoded.id).populate('department', 'name code');
    if (!user) throw new ApiError(401, 'The user linked to this token no longer exists.');
    if (!user.isActive) throw new ApiError(403, 'Your account has been deactivated. Contact an administrator.');
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return next(new ApiError(401, 'Invalid authentication token.'));
    if (err.name === 'TokenExpiredError') return next(new ApiError(401, 'Your session has expired. Please log in again.'));
    next(err);
  }
}

/** Restricts a route to specific roles: authorize('Admin', 'Production Manager') */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authorized.'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. This action requires one of: ${roles.join(', ')}.`));
    }
    next();
  };
}

/** Fine grained permission check against the RBAC matrix: permit('production:create') */
function permit(permission) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authorized.'));
    if (!can(req.user.role, permission)) {
      return next(new ApiError(403, `Access denied. Your role (${req.user.role}) cannot perform this action.`));
    }
    next();
  };
}

module.exports = { protect, authorize, permit };
