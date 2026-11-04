const Department = require('../models/Department');
const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, { searchFields: ['name', 'code', 'head'], extraFilters: [] });
  const [data, total] = await Promise.all([
    Department.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.all = asyncHandler(async (req, res) => {
  const data = await Department.find({ isActive: true }).sort({ name: 1 }).lean();
  res.json({ success: true, data });
});

exports.create = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  res.status(201).json({ success: true, message: 'Department created successfully.', data: dept });
});

exports.update = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!dept) throw new ApiError(404, 'Department not found.');
  res.json({ success: true, message: 'Department updated successfully.', data: dept });
});

exports.remove = asyncHandler(async (req, res) => {
  const employees = await Employee.countDocuments({ department: req.params.id });
  if (employees > 0) throw new ApiError(400, `Cannot delete: ${employees} employee(s) are still assigned to this department.`);
  const dept = await Department.findByIdAndDelete(req.params.id);
  if (!dept) throw new ApiError(404, 'Department not found.');
  res.json({ success: true, message: 'Department deleted successfully.' });
});
