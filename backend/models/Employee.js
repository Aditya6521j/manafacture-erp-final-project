const mongoose = require('mongoose');

const assignedTaskSchema = new mongoose.Schema(
  {
    productionOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder' },
    orderNumber: { type: String, trim: true },
    task: { type: String, trim: true },
    status: { type: String, enum: ['Assigned', 'In Progress', 'Completed'], default: 'Assigned' },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Employee name is required'], trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'Invalid email address'] },
    phone: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    role: { type: String, required: true, trim: true },
    shift: { type: String, enum: ['Shift A (06:00-14:00)', 'Shift B (14:00-22:00)', 'Shift C (22:00-06:00)', 'General'], default: 'Shift A (06:00-14:00)' },
    skillSet: [{ type: String, trim: true }],
    status: { type: String, enum: ['Available', 'On Task', 'On Leave', 'Inactive'], default: 'Available', index: true },
    assignedTasks: [assignedTaskSchema],
    joinDate: { type: Date, default: Date.now },
    hourlyRate: { type: Number, min: 0, default: 250 },
    performanceScore: { type: Number, min: 0, max: 100, default: 75 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

employeeSchema.virtual('tasksCompleted').get(function completed() {
  return (this.assignedTasks || []).filter((t) => t.status === 'Completed').length;
});

module.exports = mongoose.model('Employee', employeeSchema);
