const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    scheduleCode: { type: String, required: true, uppercase: true, trim: true },
    productionOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: true },
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    scheduleDate: { type: Date, required: true, index: true },
    shift: { type: String, enum: ['Shift A (06:00-14:00)', 'Shift B (14:00-22:00)', 'Shift C (22:00-06:00)'], required: true },
    startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:mm'] },
    endTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:mm'] },
    plannedQuantity: { type: Number, required: true, min: 1 },
    producedQuantity: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Delayed', 'Cancelled'], default: 'Scheduled', index: true },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

scheduleSchema.index({ machine: 1, scheduleDate: 1, shift: 1 });

module.exports = mongoose.model('ProductionSchedule', scheduleSchema);
