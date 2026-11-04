const mongoose = require('mongoose');

const STATUS = ['Running', 'Idle', 'Under Maintenance', 'Breakdown'];

const machineSchema = new mongoose.Schema(
  {
    machineCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Machine name is required'], trim: true, maxlength: 120 },
    type: { type: String, enum: ['CNC Machine', 'Injection Molding', 'Lathe', 'Press', 'Welding Robot', 'Packaging Unit', 'Assembly Line', 'Furnace'], required: true },
    manufacturer: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    serialNumber: { type: String, trim: true, default: '' },
    capacityPerHour: { type: Number, min: 1, default: 50 },
    location: { type: String, trim: true, default: 'Shop Floor A' },
    status: { type: String, enum: STATUS, default: 'Idle', index: true },
    operatingHours: { type: Number, min: 0, default: 0 },
    utilizationPercentage: { type: Number, min: 0, max: 100, default: 0 },
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    assignedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder' },
    breakdownReason: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

machineSchema.statics.STATUS = STATUS;

module.exports = mongoose.model('Machine', machineSchema);
