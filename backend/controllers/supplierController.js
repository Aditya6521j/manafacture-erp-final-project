const Supplier = require('../models/Supplier');
const RawMaterial = require('../models/RawMaterial');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, { searchFields: ['name', 'supplierCode', 'contactPerson', 'email'] });
  const [data, total] = await Promise.all([
    Supplier.find(filter).populate('materialsSupplied', 'name materialCode').sort(sort).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.all = asyncHandler(async (req, res) => {
  const data = await Supplier.find({ isActive: true }).select('name supplierCode').sort({ name: 1 }).lean();
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json({ success: true, message: 'Supplier created successfully.', data: supplier });
});

exports.update = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  res.json({ success: true, message: 'Supplier updated successfully.', data: supplier });
});

exports.remove = asyncHandler(async (req, res) => {
  const linked = await RawMaterial.countDocuments({ supplier: req.params.id });
  if (linked) throw new ApiError(400, `Cannot delete: ${linked} raw material(s) are linked to this supplier.`);
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new ApiError(404, 'Supplier not found.');
  res.json({ success: true, message: 'Supplier deleted successfully.' });
});
