const mongoose = require('mongoose');

const STATUS = ['Planned', 'Approved', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
const PRIORITY = ['Low', 'Medium', 'High', 'Critical'];

const materialLineSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    materialName: { type: String, trim: true },
    unit: { type: String, trim: true, default: 'Kg' },
    requiredQty: { type: Number, required: true, min: 0 },
    consumedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const productionOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true },
    productCode: { type: String, trim: true },
    quantity: { type: Number, required: [true, 'Production quantity is required'], min: [1, 'Quantity must be at least 1'] },
    producedQuantity: { type: Number, default: 0, min: 0 },
    rejectedQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'Nos' },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    expectedCompletionDate: { type: Date, required: [true, 'Completion date is required'] },
    actualCompletionDate: { type: Date },
    priority: { type: String, enum: PRIORITY, default: 'Medium' },
    status: { type: String, enum: STATUS, default: 'Planned', index: true },
    productionManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    machines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Machine' }],
    materials: [materialLineSchema],
    notes: { type: String, trim: true, maxlength: 600, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productionOrderSchema.index({ status: 1, priority: 1, startDate: -1 });
productionOrderSchema.index({ productName: 'text', orderNumber: 'text' });

productionOrderSchema.virtual('progressPercentage').get(function progress() {
  if (!this.quantity) return 0;
  return Math.min(100, Math.round((this.producedQuantity / this.quantity) * 100));
});

productionOrderSchema.virtual('isDelayed').get(function delayed() {
  if (this.status === 'Completed' || this.status === 'Cancelled') return false;
  return new Date(this.expectedCompletionDate) < new Date();
});

productionOrderSchema.pre('validate', function syncStatus(next) {
  if (this.startDate && this.expectedCompletionDate && this.expectedCompletionDate < this.startDate) {
    return next(new Error('Completion date must be after the start date'));
  }
  next();
});

productionOrderSchema.statics.STATUS = STATUS;
productionOrderSchema.statics.PRIORITY = PRIORITY;

module.exports = mongoose.model('ProductionOrder', productionOrderSchema);
