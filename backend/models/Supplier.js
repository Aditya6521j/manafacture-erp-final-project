const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    supplierCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Supplier name is required'], trim: true, maxlength: 120 },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, lowercase: true, trim: true, match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'Invalid email address'] },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    gstin: { type: String, uppercase: true, trim: true, default: '' },
    materialsSupplied: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' }],
    rating: { type: Number, min: 0, max: 5, default: 4 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
