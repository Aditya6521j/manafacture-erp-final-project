const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productCode: { type: String, required: [true, 'Product ID is required'], unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true },
    unit: { type: String, default: 'Nos', enum: ['Nos', 'Kg', 'Ton', 'Meter', 'Litre', 'Box', 'Set'] },
    specification: { type: String, trim: true, default: '' },
    drawingNumber: { type: String, trim: true, default: '' },
    standardCycleTimeMin: { type: Number, min: 0.1, default: 10 },
    unitPrice: { type: Number, min: 0, default: 0 },
    qualityStandard: { type: String, default: 'ISO 9001:2015' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', productCode: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
