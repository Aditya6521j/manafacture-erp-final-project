const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema(
  {
    maintenanceCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    machine: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
    machineName: { type: String, trim: true },
    type: { type: String, enum: ['Preventive', 'Breakdown', 'Corrective', 'Predictive'], required: true },
    scheduledDate: { type: Date, required: true },
    completedDate: { type: Date },
    technician: { type: String, trim: true, default: '' },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 600 },
    partsReplaced: [{ type: String, trim: true }],
    downtimeHours: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
