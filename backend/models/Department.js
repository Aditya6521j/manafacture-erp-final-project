const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true, maxlength: 80 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    head: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: 'Plant 1' },
    headcount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
