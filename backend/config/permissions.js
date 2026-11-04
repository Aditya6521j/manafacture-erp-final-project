/**
 * Role Based Access Control matrix.
 * `resource:action` strings are checked by the `authorize` middleware.
 */
const ROLES = ['Admin', 'Production Manager', 'Quality Control Inspector', 'Inventory Manager', 'Machine Operator'];

const PERMISSIONS = {
  Admin: ['*'],
  'Production Manager': [
    'dashboard:view',
    'production:view', 'production:create', 'production:update', 'production:delete', 'production:approve',
    'schedule:view', 'schedule:create', 'schedule:update', 'schedule:delete',
    'inventory:view', 'quality:view', 'defect:view', 'defect:create',
    'machine:view', 'employee:view', 'employee:assign',
    'report:view', 'report:download', 'notification:view',
  ],
  'Quality Control Inspector': [
    'dashboard:view',
    'production:view', 'schedule:view',
    'quality:view', 'quality:create', 'quality:update', 'quality:approve',
    'defect:view', 'defect:create', 'defect:update',
    'machine:view', 'inventory:view',
    'report:view', 'report:download', 'notification:view',
  ],
  'Inventory Manager': [
    'dashboard:view',
    'inventory:view', 'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:purchase',
    'supplier:view', 'supplier:create', 'supplier:update', 'supplier:delete',
    'production:view', 'quality:view',
    'report:view', 'report:download', 'notification:view',
  ],
  'Machine Operator': [
    'dashboard:view',
    'production:view', 'production:update_progress',
    'schedule:view',
    'machine:view', 'machine:update_status', 'machine:report_breakdown',
    'quality:view', 'defect:view', 'defect:create',
    'notification:view',
  ],
};

function can(role, permission) {
  const list = PERMISSIONS[role] || [];
  return list.includes('*') || list.includes(permission);
}

module.exports = { ROLES, PERMISSIONS, can };
