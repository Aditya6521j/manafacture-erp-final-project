const ProductionSchedule = require('../models/ProductionSchedule');
const Machine = require('../models/Machine');
const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildQuery } = require('../utils/queryFeatures');
const generateCode = require('../utils/generateCode');

const POPULATE = [
  { path: 'productionOrder', select: 'orderNumber productName status priority expectedCompletionDate quantity producedQuantity' },
  { path: 'machine', select: 'machineCode name type status' },
  { path: 'employees', select: 'employeeId name role shift' },
];

/** GET /api/schedules — supports ?view=daily|weekly|monthly with ?date= */
exports.list = asyncHandler(async (req, res) => {
  const { filter, sort, skip, limit, page } = buildQuery(req.query, {
    searchFields: [],
    extraFilters: ['status', 'shift', 'machine'],
    dateField: 'scheduleDate',
  });
  if (req.query.order) filter.productionOrder = req.query.order;

  // Calendar window (daily / weekly / monthly)
  if (req.query.view && req.query.date) {
    const base = new Date(req.query.date);
    const start = new Date(base);
    const end = new Date(base);
    if (req.query.view === 'daily') {
      end.setHours(23, 59, 59, 999);
    } else if (req.query.view === 'weekly') {
      const day = base.getDay();
      start.setDate(base.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(base.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    filter.scheduleDate = { $gte: start, $lte: end };
  }

  const [data, total] = await Promise.all([
    ProductionSchedule.find(filter).populate(POPULATE).sort({ scheduleDate: 1, startTime: 1 }).skip(skip).limit(req.query.view ? 500 : limit).lean(),
    ProductionSchedule.countDocuments(filter),
  ]);

  // detect conflicts: same machine + date + overlapping shift
  const conflicts = [];
  const keyed = {};
  data.forEach((s) => {
    const key = `${s.machine?._id}_${new Date(s.scheduleDate).toDateString()}_${s.shift}`;
    keyed[key] = keyed[key] || [];
    keyed[key].push(s);
  });
  Object.entries(keyed).forEach(([key, items]) => {
    if (items.length > 1) conflicts.push({ key, scheduleIds: items.map((i) => i._id), machine: items[0].machine?.name });
  });

  const delayed = data.filter((s) => s.status === 'Delayed' || (s.status !== 'Completed' && new Date(s.scheduleDate) < new Date(new Date().toDateString())));

  res.json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) || 1, conflicts, delayedCount: delayed.length },
  });
});

exports.get = asyncHandler(async (req, res) => {
  const schedule = await ProductionSchedule.findById(req.params.id).populate(POPULATE);
  if (!schedule) throw new ApiError(404, 'Schedule not found.');
  res.json({ success: true, data: schedule });
});

exports.create = asyncHandler(async (req, res) => {
  const { productionOrder, machine, employees = [], scheduleDate, shift, startTime, endTime, plannedQuantity, notes, status } = req.body;

  const machineDoc = await Machine.findById(machine);
  if (!machineDoc) throw new ApiError(404, 'Selected machine does not exist.');
  if (machineDoc.status === 'Breakdown') throw new ApiError(400, `${machineDoc.machineCode} is under breakdown and cannot be scheduled.`);

  if (startTime >= endTime) throw new ApiError(400, 'End time must be after the start time.');

  const clash = await ProductionSchedule.findOne({ machine, scheduleDate: new Date(scheduleDate), shift, status: { $ne: 'Cancelled' } });
  if (clash) throw new ApiError(409, `${machineDoc.name} is already scheduled for ${shift} on ${new Date(scheduleDate).toDateString()}.`);

  const schedule = await ProductionSchedule.create({
    scheduleCode: await generateCode(ProductionSchedule, 'scheduleCode', 'SCH'),
    productionOrder,
    machine,
    employees,
    scheduleDate,
    shift,
    startTime,
    endTime,
    plannedQuantity,
    notes,
    status: status || 'Scheduled',
    createdBy: req.user._id,
  });

  if (employees.length) {
    await Employee.updateMany({ _id: { $in: employees } }, { $set: { status: 'On Task' } });
  }
  await Machine.findByIdAndUpdate(machine, { assignedOrder: productionOrder });

  res.status(201).json({ success: true, message: 'Production schedule created successfully.', data: await schedule.populate(POPULATE) });
});

exports.update = asyncHandler(async (req, res) => {
  const schedule = await ProductionSchedule.findById(req.params.id);
  if (!schedule) throw new ApiError(404, 'Schedule not found.');

  const { scheduleDate, machine, shift, startTime, endTime, employees, ...rest } = req.body;

  if (machine && String(machine) !== String(schedule.machine)) {
    const clash = await ProductionSchedule.findOne({
      machine,
      scheduleDate: new Date(scheduleDate || schedule.scheduleDate),
      shift: shift || schedule.shift,
      status: { $ne: 'Cancelled' },
      _id: { $ne: schedule._id },
    });
    if (clash) throw new ApiError(409, 'This machine already has a schedule for the selected date and shift.');
    schedule.machine = machine;
  }
  if (startTime && endTime && startTime >= endTime) throw new ApiError(400, 'End time must be after the start time.');

  if (scheduleDate) schedule.scheduleDate = scheduleDate;
  if (shift) schedule.shift = shift;
  if (startTime) schedule.startTime = startTime;
  if (endTime) schedule.endTime = endTime;
  if (Array.isArray(employees)) schedule.employees = employees;
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined && !['scheduleCode', 'createdBy'].includes(k)) schedule[k] = v;
  });

  await schedule.save();
  res.json({ success: true, message: 'Schedule updated successfully.', data: await schedule.populate(POPULATE) });
});

exports.remove = asyncHandler(async (req, res) => {
  const schedule = await ProductionSchedule.findByIdAndDelete(req.params.id);
  if (!schedule) throw new ApiError(404, 'Schedule not found.');
  if (schedule.employees?.length) {
    await Employee.updateMany({ _id: { $in: schedule.employees } }, { $set: { status: 'Available' } });
  }
  res.json({ success: true, message: 'Schedule deleted successfully.' });
});
