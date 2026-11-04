const mongoose = require('mongoose');

const STATUS = ['Passed', 'Failed', 'Pending Inspection', 'Rework Required'];
const DEFECT_CATEGORIES = ['Dimensional Defect', 'Surface Defect', 'Material Defect', 'Assembly Defect', 'Functional Defect', 'Packaging Defect'];

const parameterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: '' },
    standardValue: { type: Number },
    minLimit: { type: Number, required: true },
    maxLimit: { type: Number, required: true },
    actualValue: { type: Number, required: true },
    result: { type: String, enum: ['Pass', 'Fail'], default: 'Pass' },
  },
  { _id: false }
);

const qualityInspectionSchema = new mongoose.Schema(
  {
    inspectionNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    productionOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: true },
    orderNumber: { type: String, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, trim: true },
    batchNumber: { type: String, required: [true, 'Batch number is required'], uppercase: true, trim: true },
    inspectionDate: { type: Date, required: true, default: Date.now },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectorName: { type: String, trim: true },
    qualityStandard: { type: String, trim: true, default: 'ISO 9001:2015' },
    inspectedQuantity: { type: Number, required: true, min: [1, 'Inspected quantity must be at least 1'] },
    passedQuantity: { type: Number, required: true, min: 0, default: 0 },
    rejectedQuantity: { type: Number, required: true, min: 0, default: 0 },
    reworkQuantity: { type: Number, min: 0, default: 0 },
    parameters: [parameterSchema],
    qualityPassPercentage: { type: Number, min: 0, max: 100, default: 0 },
    defectPercentage: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: STATUS, default: 'Pending Inspection', index: true },
    remarks: { type: String, trim: true, maxlength: 600, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

qualityInspectionSchema.index({ inspectionDate: -1, status: 1 });
qualityInspectionSchema.index({ batchNumber: 1 });

/** Auto-calculate parameter results, pass %, defect % and the inspection status. */
qualityInspectionSchema.pre('save', function calculate(next) {
  if (Array.isArray(this.parameters)) {
    this.parameters.forEach((p) => {
      p.result = p.actualValue >= p.minLimit && p.actualValue <= p.maxLimit ? 'Pass' : 'Fail';
    });
  }

  const inspected = Number(this.inspectedQuantity) || 0;
  const passed = Number(this.passedQuantity) || 0;
  const rejected = Number(this.rejectedQuantity) || 0;

  if (inspected > 0) {
    this.qualityPassPercentage = Math.round((passed / inspected) * 10000) / 100;
    this.defectPercentage = Math.round((rejected / inspected) * 10000) / 100;
  } else {
    this.qualityPassPercentage = 0;
    this.defectPercentage = 0;
  }

  const failedParams = (this.parameters || []).filter((p) => p.result === 'Fail').length;
  if (this.status === 'Pending Inspection') {
    // keep manual pending status
  } else if (this.reworkQuantity > 0 && this.status !== 'Passed') {
    this.status = 'Rework Required';
  } else if (failedParams > 0 || this.defectPercentage > 5) {
    this.status = 'Failed';
  } else {
    this.status = 'Passed';
  }
  next();
});

qualityInspectionSchema.statics.STATUS = STATUS;
qualityInspectionSchema.statics.DEFECT_CATEGORIES = DEFECT_CATEGORIES;

module.exports = mongoose.model('QualityInspection', qualityInspectionSchema);
