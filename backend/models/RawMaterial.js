const mongoose = require('mongoose');

const CATEGORIES = ['Metal', 'Plastic', 'Rubber', 'Chemical', 'Electrical', 'Packaging', 'Fasteners', 'Other'];
const UNITS = ['Kg', 'Ton', 'Nos', 'Meter', 'Litre', 'Box', 'Sheet'];

const rawMaterialSchema = new mongoose.Schema(
  {
    materialCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Material name is required'], trim: true, maxlength: 120 },
    category: { type: String, enum: CATEGORIES, required: true },
    unit: { type: String, enum: UNITS, default: 'Kg' },
    availableQuantity: { type: Number, required: true, min: [0, 'Available quantity cannot be negative'], default: 0 },
    minimumStockLevel: { type: Number, required: true, min: 0, default: 100 },
    requiredQuantity: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, min: 0, default: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    warehouseLocation: { type: String, trim: true, default: 'WH-A / Rack 1' },
    lastRestockedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

rawMaterialSchema.index({ name: 'text', materialCode: 'text' });
rawMaterialSchema.index({ category: 1 });

rawMaterialSchema.virtual('stockStatus').get(function status() {
  if (this.availableQuantity <= 0) return 'Out of Stock';
  if (this.availableQuantity < this.minimumStockLevel) return 'Low Stock';
  return 'In Stock';
});
rawMaterialSchema.virtual('isLowStock').get(function low() {
  return this.availableQuantity < this.minimumStockLevel;
});

rawMaterialSchema.statics.CATEGORIES = CATEGORIES;
rawMaterialSchema.statics.UNITS = UNITS;

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
