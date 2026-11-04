const MaintenanceRecord = require('../models/MaintenanceRecord');
const Machine = require('../models/Machine');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['maintenanceCode', 'machineName', 'technician', 'description'],
    extraFilters: ['type', 'status'],
    dateField: 'scheduledDate',
  });
  if (req.query.machine) filter.machine = req.query.machine;
  const [data, total] = await Promise.all([
    MaintenanceRecord.find(filter).populate('machine', 'machineCode name status').sort(sort).skip(skip).limit(limit).lean(),
    MaintenanceRecord.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.create = asyncHandler(async (req, res) => {
  const machine = await Machine.findById(req.body.machine);
  if (!machine) throw new ApiError(404, 'Machine not found.');
  const record = await MaintenanceRecord.create({
    ...req.body,
    maintenanceCode: await generateCode(MaintenanceRecord, 'maintenanceCode', 'MNT'),
    machineName: machine.name,
  });
  res.status(201).json({ success: true, message: 'Maintenance record created successfully.', data: record });
});

exports.update = asyncHandler(async (req, res) => {
  const record = await MaintenanceRecord.findById(req.params.id);
  if (!record) throw new ApiError(404, 'Maintenance record not found.');
  Object.entries(req.body).forEach(([k, v]) => {
    if (v !== undefined && k !== 'maintenanceCode') record[k] = v;
  });
  if (req.body.status === 'Completed' && !record.completedDate) {
    record.completedDate = new Date();
    await Machine.findByIdAndUpdate(record.machine, { status: 'Idle', lastMaintenanceDate: record.completedDate });
  }
  await record.save();
  res.json({ success: true, message: 'Maintenance record updated successfully.', data: record });
});

exports.remove = asyncHandler(async (req, res) => {
  const record = await MaintenanceRecord.findByIdAndDelete(req.params.id);
  if (!record) throw new ApiError(404, 'Maintenance record not found.');
  res.json({ success: true, message: 'Maintenance record deleted successfully.' });
});
