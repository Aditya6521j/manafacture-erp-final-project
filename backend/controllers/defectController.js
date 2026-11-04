const DefectRecord = require('../models/DefectRecord');
const ProductionOrder = require('../models/ProductionOrder');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');
const { createNotification } = require('../services/notificationService');

const POPULATE = [
  { path: 'productionOrder', select: 'orderNumber productName' },
  { path: 'product', select: 'name productCode' },
  { path: 'responsibleDepartment', select: 'name code' },
  { path: 'reportedBy', select: 'name role' },
];

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['defectNumber', 'productName', 'batchNumber', 'description'],
    extraFilters: ['defectCategory', 'severity', 'reworkStatus', 'status'],
    dateField: 'detectedDate',
  });
  const [data, total] = await Promise.all([
    DefectRecord.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit).lean(),
    DefectRecord.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.get = asyncHandler(async (req, res) => {
  const doc = await DefectRecord.findById(req.params.id).populate(POPULATE);
  if (!doc) throw new ApiError(404, 'Defect record not found.');
  res.json({ success: true, data: doc });
});

exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  let order = null;
  if (body.productionOrder) {
    order = await ProductionOrder.findById(body.productionOrder);
    if (!order) throw new ApiError(404, 'Selected production order does not exist.');
    body.orderNumber = order.orderNumber;
    body.product = order.product;
    body.productName = order.productName;
  }
  body.defectNumber = await generateCode(DefectRecord, 'defectNumber', 'DEF');
  body.reportedBy = req.user._id;
  body.reportedByName = req.user.name;
  if (req.files?.length) body.images = req.files.map((f) => `/uploads/${f.filename}`);
  else if (typeof body.images === 'string') body.images = [body.images];

  const defect = await DefectRecord.create(body);

  if (order && defect.quantity > 0) {
    await ProductionOrder.findByIdAndUpdate(order._id, { $inc: { rejectedQuantity: defect.quantity } });
  }
  await createNotification({
    title: `Defect reported: ${defect.defectNumber}`,
    message: `${defect.quantity} unit(s) of ${defect.productName || 'product'} — ${defect.defectCategory} (${defect.severity}).`,
    type: 'quality_failure',
    severity: defect.severity === 'Critical' ? 'critical' : 'warning',
    module: 'defects',
    referenceId: defect._id,
    targetRoles: ['Admin', 'Production Manager', 'Quality Control Inspector'],
    link: '/defects',
  });

  res.status(201).json({ success: true, message: 'Defect recorded successfully.', data: await defect.populate(POPULATE) });
});

exports.update = asyncHandler(async (req, res) => {
  const defect = await DefectRecord.findById(req.params.id);
  if (!defect) throw new ApiError(404, 'Defect record not found.');

  const body = { ...req.body };
  if (req.files?.length) body.images = [...(defect.images || []), ...req.files.map((f) => `/uploads/${f.filename}`)];
  Object.entries(body).forEach(([k, v]) => {
    if (v !== undefined && !['defectNumber', 'reportedBy'].includes(k)) defect[k] = v;
  });
  if (body.status === 'Closed' && !defect.closedAt) defect.closedAt = new Date();
  await defect.save();
  res.json({ success: true, message: 'Defect record updated successfully.', data: await defect.populate(POPULATE) });
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await DefectRecord.findByIdAndDelete(req.params.id);
  if (!doc) throw new ApiError(404, 'Defect record not found.');
  res.json({ success: true, message: 'Defect record deleted successfully.' });
});

exports.stats = asyncHandler(async (req, res) => {
  const [byCategory, bySeverity, byRework, byMonth] = await Promise.all([
    DefectRecord.aggregate([{ $group: { _id: '$defectCategory', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } }, { $sort: { quantity: -1 } }]),
    DefectRecord.aggregate([{ $group: { _id: '$severity', quantity: { $sum: '$quantity' } } }]),
    DefectRecord.aggregate([{ $group: { _id: '$reworkStatus', quantity: { $sum: '$quantity' } } }]),
    DefectRecord.aggregate([
      { $match: { detectedDate: { $gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) } } },
      { $group: { _id: { y: { $year: '$detectedDate' }, m: { $month: '$detectedDate' } }, quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
  ]);
  const total = await DefectRecord.countDocuments();
  res.json({
    success: true,
    data: {
      total,
      totalQuantity: byCategory.reduce((s, c) => s + c.quantity, 0),
      byCategory: byCategory.map((c) => ({ category: c._id, quantity: c.quantity, incidents: c.count })),
      bySeverity: bySeverity.map((s) => ({ severity: s._id, quantity: s.quantity })),
      byRework: byRework.map((r) => ({ status: r._id, quantity: r.quantity })),
      byMonth: byMonth.map((m) => ({ year: m._id.y, month: m._id.m, quantity: m.quantity, incidents: m.count })),
    },
  });
});
