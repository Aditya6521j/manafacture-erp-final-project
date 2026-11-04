const ProductionOrder = require('../models/ProductionOrder');
const Product = require('../models/Product');
const Machine = require('../models/Machine');
const RawMaterial = require('../models/RawMaterial');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');
const { createNotification } = require('../services/notificationService');
const { consumeMaterial } = require('../services/inventoryService');

const POPULATE = [
  { path: 'product', select: 'name productCode category unit' },
  { path: 'productionManager', select: 'name email role' },
  { path: 'department', select: 'name code' },
  { path: 'machines', select: 'machineCode name status type' },
  { path: 'materials.material', select: 'materialCode name unit availableQuantity' },
];

/** GET /api/production-orders */
exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['orderNumber', 'productName', 'productCode'],
    extraFilters: ['status', 'priority'],
    dateField: 'startDate',
    extraFilters: ['status', 'priority', 'productionManager', 'department'],
  });
  if (req.query.machine) filter.machines = req.query.machine;
  if (req.query.delayed === 'true') {
    filter.expectedCompletionDate = { $lt: new Date() };
    filter.status = { $nin: ['Completed', 'Cancelled'] };
  }

  const [data, total] = await Promise.all([
    ProductionOrder.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    ProductionOrder.countDocuments(filter),
  ]);

  const withProgress = data.map((o) => ({
    ...o,
    progressPercentage: o.quantity ? Math.min(100, Math.round((o.producedQuantity / o.quantity) * 100)) : 0,
    isDelayed: !['Completed', 'Cancelled'].includes(o.status) && new Date(o.expectedCompletionDate) < new Date(),
  }));

  res.json({ success: true, data: withProgress, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

/** GET /api/production-orders/:id */
exports.get = asyncHandler(async (req, res) => {
  const order = await ProductionOrder.findById(req.params.id).populate(POPULATE);
  if (!order) throw new ApiError(404, 'Production order not found.');
  res.json({ success: true, data: order });
});

/** POST /api/production-orders */
exports.create = asyncHandler(async (req, res) => {
  const {
    product: productId, quantity, startDate, expectedCompletionDate, priority, productionManager,
    department, machines = [], materials = [], notes, status = 'Planned',
  } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Selected product does not exist.');
  if (new Date(expectedCompletionDate) < new Date(startDate)) {
    throw new ApiError(400, 'Completion date must be on or after the start date.');
  }

  const lines = [];
  for (const m of materials) {
    const material = await RawMaterial.findById(m.material);
    if (!material) throw new ApiError(404, 'One of the selected raw materials does not exist.');
    if (Number(m.requiredQty) <= 0) throw new ApiError(400, `Required quantity for ${material.name} must be greater than zero.`);
    lines.push({ material: material._id, materialName: material.name, unit: material.unit, requiredQty: Number(m.requiredQty), consumedQty: 0 });
  }

  // Machine clash check for the requested window
  const busyMachines = await Machine.find({ _id: { $in: machines }, status: { $in: ['Breakdown', 'Under Maintenance'] } }).select('name machineCode status');
  if (busyMachines.length) {
    throw new ApiError(400, `Machine(s) unavailable for production: ${busyMachines.map((m) => `${m.machineCode} (${m.status})`).join(', ')}`);
  }

  const order = await ProductionOrder.create({
    orderNumber: await generateCode(ProductionOrder, 'orderNumber', 'PO'),
    product: product._id,
    productName: product.name,
    productCode: product.productCode,
    unit: product.unit,
    quantity,
    startDate,
    expectedCompletionDate,
    priority,
    status,
    productionManager: productionManager || req.user._id,
    department: department || undefined,
    machines,
    materials: lines,
    notes,
    createdBy: req.user._id,
  });

  if (machines.length) {
    await Machine.updateMany({ _id: { $in: machines } }, { $set: { assignedOrder: order._id } });
  }

  await createNotification({
    title: `New production order ${order.orderNumber}`,
    message: `${product.name} — ${quantity} ${product.unit} planned, due ${new Date(expectedCompletionDate).toDateString()}.`,
    type: 'approval',
    severity: 'info',
    module: 'production',
    referenceId: order._id,
    targetRoles: ['Admin', 'Production Manager'],
    link: '/production',
  });

  res.status(201).json({ success: true, message: 'Production order created successfully.', data: await order.populate(POPULATE) });
});

/** PUT /api/production-orders/:id */
exports.update = asyncHandler(async (req, res) => {
  const order = await ProductionOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Production order not found.');

  const { product: productId, materials, machines, ...rest } = req.body;

  if (productId && String(productId) !== String(order.product)) {
    const product = await Product.findById(productId);
    if (!product) throw new ApiError(404, 'Selected product does not exist.');
    order.product = product._id;
    order.productName = product.name;
    order.productCode = product.productCode;
    order.unit = product.unit;
  }

  if (Array.isArray(materials)) {
    const lines = [];
    for (const m of materials) {
      const material = await RawMaterial.findById(m.material);
      if (!material) throw new ApiError(404, 'One of the selected raw materials does not exist.');
      lines.push({
        material: material._id,
        materialName: material.name,
        unit: material.unit,
        requiredQty: Number(m.requiredQty),
        consumedQty: Number(m.consumedQty || 0),
      });
    }
    order.materials = lines;
  }

  if (Array.isArray(machines)) order.machines = machines;

  Object.entries(rest).forEach(([key, value]) => {
    if (['orderNumber', 'createdBy', 'producedQuantity', 'rejectedQuantity', 'actualCompletionDate'].includes(key)) return;
    if (value !== undefined) order[key] = value;
  });

  await order.save();
  res.json({ success: true, message: 'Production order updated successfully.', data: await order.populate(POPULATE) });
});

/** PATCH /api/production-orders/:id/status */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, remark } = req.body;
  if (!ProductionOrder.STATUS.includes(status)) throw new ApiError(400, `Invalid status. Allowed: ${ProductionOrder.STATUS.join(', ')}`);

  const order = await ProductionOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Production order not found.');
  const previous = order.status;
  order.status = status;
  if (status === 'Completed') {
    order.actualCompletionDate = new Date();
    if (order.producedQuantity === 0) order.producedQuantity = order.quantity;
  }
  await order.save();

  // Keep machines in sync with order lifecycle
  if (status === 'In Progress') {
    await Machine.updateMany({ _id: { $in: order.machines } }, { $set: { status: 'Running' } });
  }
  if (['Completed', 'On Hold', 'Cancelled'].includes(status)) {
    await Machine.updateMany({ _id: { $in: order.machines }, status: 'Running' }, { $set: { status: 'Idle' } });
  }

  if (status === 'Completed') {
    await exports.consumeAllocatedMaterials(order);
  }

  await createNotification({
    title: `${order.orderNumber} status updated`,
    message: `Status changed from ${previous} to ${status}${remark ? ` — ${remark}` : ''}.`,
    type: status === 'Completed' ? 'approval' : 'system',
    severity: status === 'Completed' ? 'success' : 'info',
    module: 'production',
    referenceId: order._id,
    targetRoles: ['Admin', 'Production Manager'],
    link: '/production',
  });

  res.json({ success: true, message: `Order ${order.orderNumber} is now ${status}.`, data: await order.populate(POPULATE) });
});

/** PATCH /api/production-orders/:id/progress — operator progress updates */
exports.updateProgress = asyncHandler(async (req, res) => {
  const { producedQuantity, rejectedQuantity, status } = req.body;
  const order = await ProductionOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Production order not found.');

  if (producedQuantity !== undefined) {
    const produced = Number(producedQuantity);
    if (Number.isNaN(produced) || produced < 0) throw new ApiError(400, 'Produced quantity must be a positive number.');
    if (produced > order.quantity) throw new ApiError(400, `Produced quantity cannot exceed the order quantity (${order.quantity}).`);
    order.producedQuantity = produced;
  }
  if (rejectedQuantity !== undefined) {
    const rejected = Number(rejectedQuantity);
    if (Number.isNaN(rejected) || rejected < 0) throw new ApiError(400, 'Rejected quantity must be a positive number.');
    order.rejectedQuantity = rejected;
  }
  if (status) {
    if (!ProductionOrder.STATUS.includes(status)) throw new ApiError(400, 'Invalid status value.');
    order.status = status;
    if (status === 'Completed') order.actualCompletionDate = new Date();
  }
  await order.save();

  if (order.producedQuantity >= order.quantity && order.status !== 'Completed') {
    order.status = 'Completed';
    order.actualCompletionDate = new Date();
    await order.save();
    await exports.consumeAllocatedMaterials(order);
  }

  res.json({ success: true, message: 'Production progress updated.', data: await order.populate(POPULATE) });
});

/** PATCH /api/production-orders/:id/consume-materials */
exports.consumeMaterials = asyncHandler(async (req, res) => {
  const order = await ProductionOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Production order not found.');
  const result = await exports.consumeAllocatedMaterials(order);
  res.json({ success: true, message: `Consumed ${result.consumed} material line(s).`, data: await order.populate(POPULATE) });
});

/** Deducts the remaining required quantity of every allocated material and records consumption. */
exports.consumeAllocatedMaterials = async (order) => {
  let consumed = 0;
  for (const line of order.materials) {
    const pending = Number(line.requiredQty) - Number(line.consumedQty || 0);
    if (pending <= 0) continue;
    const material = await RawMaterial.findById(line.material);
    if (!material) continue;
    const qty = Math.min(pending, material.availableQuantity);
    if (qty <= 0) continue;
    await consumeMaterial(material._id, qty);
    line.consumedQty = Number(line.consumedQty || 0) + qty;
    consumed += 1;
  }
  if (consumed) await order.save();
  return { consumed };
};

/** DELETE /api/production-orders/:id */
exports.remove = asyncHandler(async (req, res) => {
  const order = await ProductionOrder.findByIdAndDelete(req.params.id);
  if (!order) throw new ApiError(404, 'Production order not found.');
  await Machine.updateMany({ assignedOrder: order._id }, { $set: { assignedOrder: null, status: 'Idle' } });
  res.json({ success: true, message: 'Production order deleted successfully.' });
});

/** GET /api/production-orders/stats/summary */
exports.stats = asyncHandler(async (req, res) => {
  const byStatus = await ProductionOrder.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const agg = await ProductionOrder.aggregate([
    {
      $group: {
        _id: null,
        planned: { $sum: '$quantity' },
        produced: { $sum: '$producedQuantity' },
        rejected: { $sum: '$rejectedQuantity' },
      },
    },
  ]);
  res.json({
    success: true,
    data: {
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      planned: agg[0]?.planned || 0,
      produced: agg[0]?.produced || 0,
      rejected: agg[0]?.rejected || 0,
    },
  });
});
