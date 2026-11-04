const mongoose = require('mongoose');

const DEFECT_CATEGORIES = ['Dimensional Defect', 'Surface Defect', 'Material Defect', 'Assembly Defect', 'Functional Defect', 'Packaging Defect'];

const defectRecordSchema = new mongoose.Schema(
  {
    defectNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    productionOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder' },
    orderNumber: { type: String, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true },
    batchNumber: { type: String, uppercase: true, trim: true, default: '' },
    defectCategory: { type: String, enum: DEFECT_CATEGORIES, required: [true, 'Defect category is required'] },
    severity: { type: String, enum: ['Minor', 'Major', 'Critical'], default: 'Major' },
    description: { type: String, required: [true, 'Defect description is required'], trim: true, maxlength: 800 },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    images: [{ type: String }],
    responsibleDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    rootCause: { type: String, trim: true, maxlength: 600, default: '' },
    correctiveAction: { type: String, trim: true, maxlength: 600, default: '' },
    reworkStatus: { type: String, enum: ['Pending', 'In Rework', 'Reworked', 'Scrapped', 'Not Required'], default: 'Pending' },
    reworkQuantity: { type: Number, min: 0, default: 0 },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedByName: { type: String, trim: true },
    detectedDate: { type: Date, default: Date.now, required: true },
    closedAt: { type: Date },
    status: { type: String, enum: ['Open', 'Under Analysis', 'In Progress', 'Closed'], default: 'Open', index: true },
  },
  { timestamps: true }
);

defectRecordSchema.index({ defectCategory: 1, detectedDate: -1 });

defectRecordSchema.statics.DEFECT_CATEGORIES = DEFECT_CATEGORIES;

module.exports = mongoose.model('DefectRecord', defectRecordSchema);
