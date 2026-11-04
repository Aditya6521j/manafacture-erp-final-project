const mongoose = require('mongoose');

const TYPES = ['low_stock', 'deadline', 'delayed', 'breakdown', 'quality_failure', 'approval', 'maintenance', 'system'];

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 600 },
    type: { type: String, enum: TYPES, default: 'system', index: true },
    severity: { type: String, enum: ['info', 'warning', 'critical', 'success'], default: 'info' },
    module: { type: String, trim: true, default: 'system' },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    targetRoles: [{ type: String, enum: ['Admin', 'Production Manager', 'Quality Control Inspector', 'Inventory Manager', 'Machine Operator'] }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isGlobal: { type: Boolean, default: true },
    link: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
