const QualityInspection = require('../models/QualityInspection');
const ProductionOrder = require('../models/ProductionOrder');
const DefectRecord = require('../models/DefectRecord');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');
const { createNotification } = require('../services/notificationService');

const POPULATE = [
  { path: 'productionOrder', select: 'orderNumber productName status quantity producedQuantity' },
  { path: 'product', select: 'name productCode' },
  { path: 'inspector', select: 'name email role' },
  { path: 'approvedBy', select: 'name role' },
];

exports.list =asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['inspectionNumber', 'batchNumber', 'productName', 'inspectorName'],
    extraFilters: ['status', 'qualityStandard'],
    dateField: 'inspectionDate',
  });
  if (req.query.order) filter.productionOrder = req.query.order;

  const [data, total] = await Promise.all([
    QualityInspection.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit).lean(),
    QualityInspection.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await QualityInspection.findById(req.params.id).populate(POPULATE);
  if (!doc) throw new ApiError(404, 'Quality inspection not found.');
  res.json({ success: true, data: doc });
});

exports.create = asyncHandler(async (req, res) => {
  const {
    productionOrder: orderId, batchNumber, inspectionDate, inspector, qualityStandard,
    inspectedQuantity, passedQuantity, rejectedQuantity, reworkQuantity, parameters = [], remarks, status,
  } = req.body;

  const order = await ProductionOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Selected production order does not exist.');

  const inspected = Number(inspectedQuantity);
  const passed = Number(passedQuantity || 0);
  const rejected = Number(rejectedQuantity ?? inspected - passed);

  if (passed + rejected > inspected) {
    throw new ApiError(400, 'Passed + rejected quantity cannot exceed the inspected quantity.');
  }
  if (rejected < 0 || passed < 0) throw new ApiError(400, 'Quantities cannot be negative.');

  const failedParams = parameters.filter((p) => Number(p.actualValue) < Number(p.minLimit) || Number(p.actualValue) > Number(p.maxLimit)).length;
  let finalStatus = status;
  if (!finalStatus || finalStatus === 'Pending Inspection') {
    if (failedParams > 0 || (inspected > 0 && rejected / inspected > 0.05)) finalStatus = reworkQuantity > 0 ? 'Rework Required' : 'Failed';
    else finalStatus = 'Passed';
  }

  const inspection = await QualityInspection.create({
    inspectionNumber: await generateCode(QualityInspection, 'inspectionNumber', 'QI'),
    productionOrder: order._id,
    orderNumber: order.orderNumber,
    product: order.product,
    productName: order.productName,
    batchNumber,
    inspectionDate: inspectionDate || new Date(),
    inspector: inspector || req.user._id,
    inspectorName: req.body.inspectorName || req.user.name,
    qualityStandard: qualityStandard || 'ISO 9001:2015',
    inspectedQuantity: inspected,
    passedQuantity: passed,
    rejectedQuantity: rejected,
    reworkQuantity: Number(reworkQuantity || 0),
    parameters,
    status: finalStatus,
    remarks,
  });

  // Sync the order's rejected counter and raise an alert when a batch fails
  if (rejected > 0) {
    await ProductionOrder.findByIdAndUpdate(order._id, { $inc: { rejectedQuantity: rejected } });
  }
  if (inspection.status === 'Failed' || inspection.status === 'Rework Required') {
    await createNotification({
      title: `Quality failure: ${inspection.inspectionNumber}`,
      message: `Batch ${inspection.batchNumber} (${order.productName}) failed inspection with ${inspection.defectPercentage}% defects.`,
      type: 'quality_failure',
      severity: 'critical',
      module: 'quality',
      referenceId: inspection._id,
      targetRoles: ['Admin', 'Production Manager', 'Quality Control Inspector'],
      link: '/quality-control',
    });
  }

  res.status(201).json({ success: true, message: 'Quality inspection recorded successfully.', data: await inspection.populate(POPULATE) });
});

exports.update = asyncHandler(async (req, res) => {
  const inspection = await QualityInspection.findById(req.params.id);
  if (!inspection) throw new ApiError(404, 'Quality inspection not found.');

  const { inspectedQuantity, passedQuantity, rejectedQuantity, parameters, ...rest } = req.body;
  if (inspectedQuantity !== undefined) inspection.inspectedQuantity = Number(inspectedQuantity);
  if (passedQuantity !== undefined) inspection.passedQuantity = Number(passedQuantity);
  if (rejectedQuantity !== undefined) inspection.rejectedQuantity = Number(rejectedQuantity);
  if (parameters !== undefined) inspection.parameters = parameters;
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined && !['inspectionNumber', 'productionOrder', 'approvedBy', 'approvedAt'].includes(k)) inspection[k] = v;
  });

  await inspection.save();
  res.json({ success: true, message: 'Quality inspection updated successfully.', data: await inspection.populate(POPULATE) });
});

/** PATCH /api/inspections/:id/approve  { decision: 'Passed' | 'Failed' | 'Rework Required', remarks } */
exports.decide = asyncHandler(async (req, res) => {
  const { decision, remarks } = req.body;
  if (!['Passed', 'Failed', 'Rework Required'].includes(decision)) throw new ApiError(400, 'Decision must be Passed, Failed or Rework Required.');

  const inspection = await QualityInspection.findById(req.params.id);
  if (!inspection) throw new ApiError(404, 'Quality inspection not found.');

  inspection.status = decision;
  inspection.approvedBy = req.user._id;
  inspection.approvedAt = new Date();
  if (remarks) inspection.remarks = remarks;
  await inspection.save();

  if (decision !== 'Passed' && inspection.rejectedQuantity > 0) {
    await DefectRecord.create({
      defectNumber: `DEF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      productionOrder: inspection.productionOrder,
      orderNumber: inspection.orderNumber,
      product: inspection.product,
      productName: inspection.productName,
      batchNumber: inspection.batchNumber,
      defectCategory: 'Dimensional Defect',
      severity: decision === 'Failed' ? 'Major' : 'Minor',
      description: `Auto-generated from failed inspection ${inspection.inspectionNumber}. ${remarks || ''}`.trim(),
      quantity: inspection.rejectedQuantity,
      responsibleDepartment: undefined,
      reworkStatus: decision === 'Rework Required' ? 'Pending' : 'Not Required',
      reportedBy: req.user._id,
      reportedByName: req.user.name,
      detectedDate: new Date(),
      status: 'Open',
    });
  }

  res.json({ success: true, message: `Batch ${decision === 'Passed' ? 'approved' : decision.toLowerCase()}.`, data: await inspection.populate(POPULATE) });
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await QualityInspection.findByIdAndDelete(req.params.id);
  if (!doc) throw new ApiError(404, 'Quality inspection not found.');
  res.json({ success: true, message: 'Quality inspection deleted successfully.' });
});

exports.stats = asyncHandler(async (req, res) => {
  const [agg] = await QualityInspection.aggregate([
    {
      $group: {
        _id: null,
        inspections: { $sum: 1 },
        inspected: { $sum: '$inspectedQuantity' },
        passed: { $sum: '$passedQuantity' },
        rejected: { $sum: '$rejectedQuantity' },
      },
    },
  ]);
  const byStatus = await QualityInspection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const inspected = agg?.inspected || 0;
  res.json({
    success: true,
    data: {
      inspections: agg?.inspections || 0,
      inspected,
      passed: agg?.passed || 0,
      rejected: agg?.rejected || 0,
      qualityPassPercentage: inspected ? Math.round(((agg.passed || 0) / inspected) * 10000) / 100 : 0,
      defectPercentage: inspected ? Math.round(((agg.rejected || 0) / inspected) * 10000) / 100 : 0,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    },
  });
});
