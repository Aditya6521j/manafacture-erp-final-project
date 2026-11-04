const RawMaterial = require('../models/RawMaterial');
const ProductionOrder = require('../models/ProductionOrder');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const { consumeMaterial, purchaseMaterial, syncRequiredQuantities } = require('../services/inventoryService');

const decorate = (m) => ({
  ...m,
  stockStatus: m.availableQuantity <= 0 ? 'Out of Stock' : m.availableQuantity < m.minimumStockLevel ? 'Low Stock' : 'In Stock',
  isLowStock: m.availableQuantity < m.minimumStockLevel,
  shortage: Math.max(0, Number((m.requiredQuantity || 0) - m.availableQuantity)),
});

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['name', 'materialCode', 'warehouseLocation'],
    extraFilters: ['category', 'unit', 'supplier'],
  });
  if (req.query.lowStock === 'true') filter.$expr = { $lt: ['$availableQuantity', '$minimumStockLevel'] };

  const [data, total] = await Promise.all([
    RawMaterial.find(filter).populate('supplier', 'name supplierCode contactPerson phone').sort(sort).skip(skip).limit(limit).lean(),
    RawMaterial.countDocuments(filter),
  ]);
  res.json({ success: true, data: data.map(decorate), meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.all = asyncHandler(async (req, res) => {
  const data = await RawMaterial.find().select('materialCode name unit category availableQuantity minimumStockLevel unitPrice').sort({ name: 1 }).lean();
  res.json({ success: true, data: data.map(decorate) });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const data = await RawMaterial.find({ $expr: { $lt: ['$availableQuantity', '$minimumStockLevel'] } })
    .populate('supplier', 'name phone email')
    .sort({ availableQuantity: 1 })
    .lean();
  res.json({ success: true, data: data.map(decorate) });
});

exports.get = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id).populate('supplier', 'name supplierCode contactPerson phone email');
  if (!material) throw new ApiError(404, 'Raw material not found.');
  res.json({ success: true, data: material });
});

exports.create = asyncHandler(async (req, res) => {
  const material = await RawMaterial.create(req.body);
  res.status(201).json({ success: true, message: 'Raw material added successfully.', data: decorate(material.toObject()) });
});

exports.update = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) throw new ApiError(404, 'Raw material not found.');
  const { materialCode, ...rest } = req.body;
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined) material[k] = v;
  });
  await material.save();
  res.json({ success: true, message: 'Raw material updated successfully.', data: decorate(material.toObject()) });
});

exports.remove = asyncHandler(async (req, res) => {
  const used = await ProductionOrder.countDocuments({ 'materials.material': req.params.id });
  if (used) throw new ApiError(400, `Cannot delete: this material is allocated to ${used} production order(s).`);
  const material = await RawMaterial.findByIdAndDelete(req.params.id);
  if (!material) throw new ApiError(404, 'Raw material not found.');
  res.json({ success: true, message: 'Raw material deleted successfully.' });
});

/** POST /api/materials/:id/consume  { quantity } */
exports.consume = asyncHandler(async (req, res) => {
  const material = await consumeMaterial(req.params.id, Number(req.body.quantity));
  res.json({ success: true, message: `Consumed ${req.body.quantity} ${material.unit} of ${material.name}.`, data: decorate(material.toObject()) });
});

/** POST /api/materials/:id/purchase  { quantity, unitPrice } */
exports.purchase = asyncHandler(async (req, res) => {
  const material = await purchaseMaterial(req.params.id, Number(req.body.quantity), req.body.unitPrice);
  res.json({ success: true, message: `Stock updated: +${req.body.quantity} ${material.unit} of ${material.name}.`, data: decorate(material.toObject()) });
});

/** POST /api/materials/sync-requirements — recalculate demand from open orders */
exports.syncRequirements = asyncHandler(async (req, res) => {
  await syncRequiredQuantities(ProductionOrder);
  res.json({ success: true, message: 'Required quantities recalculated from open production orders.' });
});

exports.stats = asyncHandler(async (req, res) => {
  const [agg] = await RawMaterial.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        lowStock: { $sum: { $cond: [{ $lt: ['$availableQuantity', '$minimumStockLevel'] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$availableQuantity', 0] }, 1, 0] } },
        stockValue: { $sum: { $multiply: ['$availableQuantity', '$unitPrice'] } },
      },
    },
  ]);
  const byCategory = await RawMaterial.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, quantity: { $sum: '$availableQuantity' } } }]);
  res.json({ success: true, data: { ...(agg || { total: 0, lowStock: 0, outOfStock: 0, stockValue: 0 }), _id: undefined, byCategory } });
});
