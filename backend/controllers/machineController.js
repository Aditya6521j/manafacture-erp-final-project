const Machine = require('../models/Machine');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const ProductionOrder = require('../models/ProductionOrder');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');
const { createNotification } = require('../services/notificationService');

exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: ['name', 'machineCode', 'manufacturer', 'model', 'location'],
    extraFilters: ['status', 'type'],
  });
  const [data, total] = await Promise.all([
    Machine.find(filter).populate('assignedOrder', 'orderNumber productName status').sort(sort).skip(skip).limit(limit).lean(),
    Machine.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
});

exports.all = asyncHandler(async (req, res) => {
  const data = await Machine.find({ isActive: true }).select('machineCode name type status capacityPerHour location').sort({ name: 1 }).lean();
  res.json({ success: true, data });
});

exports.get = asyncHandler(async (req, res) => {
  const machine = await Machine.findById(req.params.id).populate('assignedOrder', 'orderNumber productName status quantity producedQuantity');
  if (!machine) throw new ApiError(404, 'Machine not found.');
  const maintenance = await MaintenanceRecord.find({ machine: machine._id }).sort({ scheduledDate: -1 }).limit(10).lean();
  res.json({ success: true, data: { ...machine.toObject(), maintenanceHistory: maintenance } });
});

exports.create = asyncHandler(async (req, res) => {
  const machine = await Machine.create(req.body);
  res.status(201).json({ success: true, message: 'Machine registered successfully.', data: machine });
});

exports.update = asyncHandler(async (req, res) => {
  const machine = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!machine) throw new ApiError(404, 'Machine not found.');
  res.json({ success: true, message: 'Machine updated successfully.', data: machine });
});

exports.remove = asyncHandler(async (req, res) => {
  const orders = await ProductionOrder.countDocuments({ machines: req.params.id, status: { $nin: ['Completed', 'Cancelled'] } });
  if (orders) throw new ApiError(400, `Cannot delete: machine is allocated to ${orders} active production order(s).`);
  const machine = await Machine.findByIdAndDelete(req.params.id);
  if (!machine) throw new ApiError(404, 'Machine not found.');
  res.json({ success: true, message: 'Machine deleted successfully.' });
});

/** PATCH /api/machines/:id/status { status, breakdownReason, operatingHoursDelta } */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, breakdownReason, operatingHoursDelta } = req.body;
  if (!Machine.STATUS.includes(status)) throw new ApiError(400, `Invalid machine status. Allowed: ${Machine.STATUS.join(', ')}`);

  const machine = await Machine.findById(req.params.id);
  if (!machine) throw new ApiError(404, 'Machine not found.');

  machine.status = status;
  if (status === 'Breakdown') {
    machine.breakdownReason = breakdownReason || machine.breakdownReason || 'Not specified';
  } else if (status !== 'Breakdown') {
    machine.breakdownReason = '';
  }
  if (operatingHoursDelta) machine.operatingHours = Math.max(0, machine.operatingHours + Number(operatingHoursDelta));
  if (status === 'Running') machine.utilizationPercentage = Math.min(100, (machine.utilizationPercentage || 0) + 2);
  await machine.save();

  if (status === 'Breakdown') {
    await MaintenanceRecord.create({
      maintenanceCode: await generateCode(MaintenanceRecord, 'maintenanceCode', 'MNT'),
      machine: machine._id,
      machineName: machine.name,
      type: 'Breakdown',
      scheduledDate: new Date(),
      technician: req.user.name,
      description: breakdownReason || `Breakdown reported by ${req.user.name}`,
      status: 'In Progress',
      downtimeHours: 0,
    });
    await createNotification({
      title: `Breakdown reported: ${machine.name}`,
      message: `${machine.machineCode} — ${machine.name} reported a breakdown: ${breakdownReason || 'reason not specified'}.`,
      type: 'breakdown',
      severity: 'critical',
      module: 'machines',
      referenceId: machine._id,
      targetRoles: ['Admin', 'Production Manager', 'Machine Operator'],
      link: '/machines',
    });
  }

  res.json({ success: true, message: `Machine ${machine.machineCode} is now ${status}.`, data: machine });
});

/** POST /api/machines/:id/maintenance — schedule preventive maintenance */
exports.scheduleMaintenance = asyncHandler(async (req, res) => {
  const machine = await Machine.findById(req.params.id);
  if (!machine) throw new ApiError(404, 'Machine not found.');

  const { type = 'Preventive', scheduledDate, technician, description, cost, downtimeHours } = req.body;
  const record = await MaintenanceRecord.create({
    maintenanceCode: await generateCode(MaintenanceRecord, 'maintenanceCode', 'MNT'),
    machine: machine._id,
    machineName: machine.name,
    type,
    scheduledDate: scheduledDate || new Date(),
    technician,
    description: description || `${type} maintenance for ${machine.name}`,
    cost,
    downtimeHours,
    status: 'Scheduled',
  });

  machine.nextMaintenanceDate = scheduledDate || new Date();
  if (type === 'Preventive') machine.status = 'Under Maintenance';
  await machine.save();

  res.status(201).json({ success: true, message: 'Maintenance scheduled successfully.', data: record });
});

exports.utilization = asyncHandler(async (req, res) => {
  const machines = await Machine.find().sort({ machineCode: 1 }).lean();
  const total = machines.length;
  const running = machines.filter((m) => m.status === 'Running').length;
  const avgUtilization = total ? Math.round(machines.reduce((s, m) => s + (m.utilizationPercentage || 0), 0) / total) : 0;
  res.json({
    success: true,
    data: {
      total,
      running,
      idle: machines.filter((m) => m.status === 'Idle').length,
      maintenance: machines.filter((m) => m.status === 'Under Maintenance').length,
      breakdown: machines.filter((m) => m.status === 'Breakdown').length,
      avgUtilization,
      totalOperatingHours: machines.reduce((s, m) => s + (m.operatingHours || 0), 0),
      machines,
    },
  });
});
